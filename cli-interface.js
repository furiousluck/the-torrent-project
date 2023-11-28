#!/usr/bin/env node

var minimist = require('minimist')
var fs = require('fs')
var log = require('single-line-log').stdout
var bytes = require('pretty-bytes')
// var chalk = require('chalk')
var figlet = require('figlet')
var readline = require('readline')
var chalk = require('chalk')
var pkg = require('./package.json')
var torrent = require('./')
var createTorrent = require('create-torrent')
var parseTorrent = require('parse-torrent')
var concat = require('concat-stream')
var humanSize = require('human-format')
var prettySeconds = require('pretty-seconds')
var gradient = require('gradient-string')
const { start } = require('repl')
var torrents = require('torrent-stream')



figlet('Torrent - Pro', function(err, data) {
    if(err){
        console.log('Something went wrong...');
        console.dir(err);
        return;
    }
    console.log(gradient.atlas(data));
})

var argv = minimist(process.argv.slice(2), {
    alias: {outfile:'o'}
})

if(argv.version){
    console.log(pkg.version)
    process.exit(0)
}

if(argv.help || argv._.length ===0){
    console.log(fs.readFileSync(__dirname+'/guide.txt', 'utf8'));
    process.exit(0);
}

if(argv.quiet) argv.log = function(){};

var source = argv._.shift();
var infile;

if(source==='create')
{
    var dir = argv._.shift();
    var outfile = argv.outfile || 'out.torrent';
    if(outfile === '-'){
        outfile = null;
    }
    if(outfile && fs.existsSync(outfile)){
        console.log('File already exists: ' + outfile);
        console.error('Overwrite not possible.');
        process.exit(1);
    }

    var opts = {}
    if(argv.tracker){
        if(typeof argv.tracker === 'string')opts.announceList = [[argv.tracker]];
        else opts.announceList = argv.tracker.map(function(t){return [t]});
    }

    opts.urlList = argv.urlList;

    createTorrent(dir, opts, function(err, torrent){
        if(err){
            console.error(err.message);
            process.exit(1);
        }
        if(outfile){
            fs.writeFileSync(outfile, torrent);
        }
        else{
            process.stdout.write(torrent);
        }
    })
}else if(source ==='info'){
    infile = argv._.shift();
    getInfo(infile,function(parsed){
        delete parsed.infoBuffer;
        delete parsed.info.pieces;
        console.log(JSON.stringify(toString(parsed), null, 2));

        function toString(obj){
            if(Array.isArray(obj)){
                return obj.map(toString);
            }else if(Buffer.isBuffer(obj)){
                return obj.toString('utf-8');
            }else if(typeof obj === 'object'){
                return Object.keys(obj).reduce(function(acc, key){
                    acc[key] = toString(obj[key]);
                    return acc;
                },{});
            }
            else return obj;
        }
    })
}else if(source==='ls' || source==='list'){
    infile = argv._.shift();
    getInfo(infile,function(parsed){
        parsed.files.forEach(function(file){
            var prefix = ''
            if(argv.s && argv.h){
                prefix = humanSize(file.length).replace(/(\d)B$/,'$1 B');
                prefix = Array(10-prefix.length).join(' ')+prefix+' ';
            }else if(argv.s){
                prefix = String(file.length);
                prefix = Array(10-prefix.length).join(' ')+prefix+' ';
            }
            console.log(prefix+file.path);
        })
    })
}else if(source === 'seed'){
    infile = argv._.shift();
    var filename = infile;
    if(!argv.path)argv.path = process.cwd();
    getSource(infile,function(body){
        var dl = torrent(body,argv)
        dl.on('ready',function(){
            var seeding = dl.torrent.pieces.every(function(piece,i){
                return dl.bitfield.get(i);
            })
            if(!seeding){
                console.error('Missing Files!!')
                process.exit(1);
            }else{
                console.log('Verified files successfully!');
            }
            function status(){
                log(
                    'Seeding '+filename+'\n'+
                    'Connected to '+dl.swarm.wires.reduce(notChoked,0)+'/'+dl.swarm.wires.length+' peers\n'+
                    'Uploaded '+bytes(dl.swarm.uploaded)+' ('+bytes(dl.swarm.uploadSpeed())+')\n'
                )
            }
            setInterval(status,1000);
            status();
        })
        dl.listen(0);
    })
}else{
    if(!argv.path)argv.path = process.cwd();

    getSource(source,function(body){
        var dl = torrents(body,argv)
        
        dl.on('ready',function(){
            if(argv.peer){
                console.log('Connecting to peer: '+argv.peer);
                dl.connect(argv.peer);
            }
            var fileCount = dl.files.length;
            var timeStart = (new Date()).getTime();
            console.log(fileCount.toString(),(fileCount===1?'file':'files'),'in torrent');
            console.log(dl.files.map(function(f){
                return f.name.trim()
            }).join('\n'));
            
            var selectedFiles = [];
            function promptUserForFile(index){
                if(index>=fileCount){
                    startDownload(selectedFiles);
                    return;
                }
                const file = dl.files[index];
                // console.log(file);
                console.log('File: ',file.name,'(',bytes(file.length),')');

                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                })

                rl.question('Download this file? (Y/n)',function(answer){
                    if(answer.toLowerCase()!=='n'){
                        console.log(chalk.green('Selected file: ',file.name));
                        selectedFiles.push(file);
                    }else{
                        console.log(chalk.red('Skipping file: ',file.name));
                        // Deselect all files on initial download
                        // dl.files.forEach(file=>file.deselect());
                        // dl.deselect(0,dl.bitfield.buffer.length-1,false);
                        file.deselect();
                    }
                    rl.close();
                    promptUserForFile(index+1);
                });
            }
            var torrentSize = 0;
            function startDownload(selectedFiles){
                selectedFiles.forEach(function(file){
                    console.log('Downloading: ',file.name,'(',bytes(file.length),')');
                    torrentSize += file.length;
                    file.select();
                    // dl.select(file._startPiece,file._endPiece,false);
                    // console.log(file);
                });
            var status = function(){
                var down = bytes(dl.swarm.downloaded);
                var downSpeed = bytes(dl.swarm.downloadSpeed())+'/s';
                var up = bytes(dl.swarm.uploaded);
                var upSpeed = bytes(dl.swarm.uploadSpeed())+'/s';
                // var torrentSize = dl.torrent.length;
                var bytesRemaining = torrentSize - dl.swarm.downloaded;
                var percent = ((dl.swarm.downloaded/dl.torrent.length)*100).toPrecision(4);
                var progressBar = '';
                var bars = ~~(percent/5);

                if(dl.swarm.downloaded>0){
                    if(dl.swarm.downloadSpeed()>0){
                        var seconds = 1000;
                        var timeNow = (new Date()).getTime();
                        var timeElapsed = (timeNow - timeStart)
                        var timeRemaining = (((timeElapsed/dl.swarm.downloaded)*bytesRemaining)/seconds).toPrecision(6);
                        timeRemaining = 'Estimated '+prettySeconds(~~timeRemaining)+' remaining';
                    }else{
                        timeRemaining = 'Unknown time remaining';   
                    }
                }else{
                    timeRemaining = 'Calculating time remaining';
                }
            
            if(percent >100){percent = 100;}

            for(var i=0;i<bars;i++){
                progressBar = progressBar + '=';
            }

            progressBar = progressBar + Array(20+1-progressBar.length).join(' ');
            log(
                'Connected to '+dl.swarm.wires.reduce(notChoked,0)+'/'+dl.swarm.wires.length+' peers\n'+
                'Downloaded '+down+' ('+downSpeed+')\n'+
                'Uploaded '+up+' ('+upSpeed+')\n'+
                'Torrent Size '+bytes(torrentSize)+'\n\n'+
                'Complete: '+percent+'%\n'+
                '['+progressBar+']\n'+
                '0%   25%    50%    75%    100%\n\n'+timeRemaining+'\n'
            )
            }
            setInterval(status,500);
            status();
        }
        promptUserForFile(0);
        })
    })
}

function notChoked(result,wire){
    return result + (wire.peerChoking ? 0 : 1);
}

function getSource(infile,cb){
    if(/^magnet:/.test(infile))return cb(infile);
    var instream = !infile || infile==='-'
    ? process.stdin
    :fs.createReadStream(infile);
    instream.pipe(concat(cb));
}

function getInfo(infile,cb){
    getSource(infile,function(body){
        try{
            var parsed = parseTorrent(body);
        }catch(err){
            console.error(err.stack);
            process.exit(1);
        }
        cb(parsed)
    })
}




