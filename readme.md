# torrent-pro

**A Pure JavaScript Torrent Program**

## Installation

To install `torrent-pro`, you can use npm:

npm install -g torrent-pro

## Usage

### Download a Torrent

Download a torrent from a magnet link or a torrent file:

torrent-pro <torrent>

**Examples:**
```bash
torrent-pro magnet:?xt=urn:btih:abcdef1234567890
```
```bash
torrent-pro "file.torrent"
```

### Seed a Torrent

Seed a torrent file:

torrent-pro seed <torrent>

**Example:**
```bash
torrent-pro seed myTorrentFile.torrent
```

### Print Torrent Information

Print information about a .torrent file to stdout as JSON:

torrent-pro info <torrent>

**Example:**
```bash
torrent-pro info myTorrentFile.torrent
```

### List Files in a Torrent

List all the files in a .torrent file:

torrent-pro ls <torrent> [OPTIONS]

**Options:**
- `-s`: Show file sizes in bytes alongside file paths.
- `-h`: Show file sizes in human units when `-s` is on.

**Example:**
```bash
torrent-pro ls myTorrentFile.torrent -sh
```

### Create a Torrent

Create a torrent file from a directory or file:

torrent-pro create <directory OR file> [-o outfile.torrent]

If an output file isn't specified with `-o`, the torrent file will be written to stdout.

**Examples:**
```bash
torrent-pro create /path/to/myDirectory -o myTorrentFile.torrent
```
```bash
torrent-pro create /path/to/myDirectory
```

## Usage Notes

- `<torrent>` can be a magnet link, a path to a .torrent file, or `-` for STDIN.

**Note:** Ensure to replace the examples with appropriate file and directory paths or magnet links.