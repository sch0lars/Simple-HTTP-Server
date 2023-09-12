const http = require('http');
const fs = require('fs');
const path = require('path');
const { exit } = require('process');

// Get the command line arguments
args = process.argv;

// Display usage if the help flag is set
if (args.indexOf('-h') > -1 || args.indexOf('--help') > -1) {
    console.log(`Usage: ${args[0].split('/').at(-1)} ${args[1].split('/').at(-1)} [-d directory] [-p port]`);
    console.log(' -d, --directory <directory>\tthe directory from which to serve the files (default: current directory)');
    console.log(' -p, --port <port>\t\tthe port number on which the HTTP service is run (default: 8080)');
    exit(0);
}

// Set the host and port for the server
const host = 'localhost';
// This is the directory from which we will serve files
var servingDirectory = './'
// This is the port on which we will run the HTTP service
var port = 8080;

// Check for the port flags
if (args.indexOf('-p') > -1 || args.indexOf('--port') > -1) {
    let portArgument;
    if (args.indexOf('-p') > -1) {
	portArgument = args[args.indexOf('-p') + 1];
    } else {
	portArgument = args[args.indexOf('--port') + 1];
    }
    if (! portArgument) {
	let timestamp = new Date().toISOString();
	console.log(`[ERROR]\t\t${timestamp}\tThe port flag requires an argument`);
	exit(1);
    } else {
	port = portArgument;
    }
}

// Check for the directory flags
if (args.indexOf('-d') > -1 || args.indexOf('--directory') > -1) {
    let directoryArgument;
    if (args.indexOf('-d') > -1) {
	directoryArgument = args[args.indexOf('-d') + 1];
    } else {
	directoryArgument = args[args.indexOf('--directory') + 1];
    }
    if (! directoryArgument) {
	let timestamp = new Date().toISOString();
	console.log(`[ERROR]\t\t${timestamp}\tThe directory flag requires an argument`);
	exit(1);
    } else {
	servingDirectory = directoryArgument;
    }
}
    
http.createServer((req, res) => {
    // Ignore requests for the favicon.ico file
    if (req.url === '/favicon.ico') {
	res.statusCode = 204; // No content
	res.end();
	return; // This return statement exits the function for favicon.ico requests
    }
    
    // This will create the path for the files
    const filePath = path.join(servingDirectory, req.url);

    // Create a timestamp for logging
    const timestamp = new Date().toISOString();
    // Get the HTTP version
    const httpRequestVersion = req.httpVersion;
    // Log the request
    console.log(`[REQUEST]\t${timestamp}\tHTTP/${httpRequestVersion} ${req.method} ${req.url}`);

    // Get the HTTP response version
    var httpResponseVersion = res.httpVersion;
    
    // Check if we are listing the directory or serving a file
    fs.stat(filePath, (err, stats) => {
	// Handle any errors
        if (err) {
	    const errorCode = err.statusCode ?? 500;
            res.writeHead(errorCode, {
                'Content-Type': 'text/plain'
            });
            res.end(`${filePath} not found`);
	    // Log the error
	    httpResponseVersion = httpRequestVersion ?? 1.1;	    
            console.log(`[ERROR]\t\t${timestamp}\tHTTP/${httpResponseVersion} ${errorCode} ${err.message}`);
        } else { // If there are no errors, serve the files
	    // Check if we are serving a directory
            if (stats.isDirectory()) {
                // Display the list of files as an HTML page
                fs.readdir(filePath, (err, files) => {
		    // Handle any errors
                    if (err) {
			const errorCode = err.statusCode ?? 500;
                        res.writeHead(errorCode, {
                            'Content-Type': 'text/plain'
                        });
                        res.end('Internal Server Error');
			// Log the error
			httpResponseVersion = httpRequestVersion ?? 1.1;
			console.log(`[ERROR]\t\t${timestamp}\tHTTP/${httpResponseVersion} ${errorCode} ${err.message}`);
                    } else { // If there are no errors, serve the directory
			// Generate an index of the directory
                        res.writeHead(200, {
                            'Content-Type': 'text/html'
                        });
                        res.write('<html><body>');
                        res.write(`<h1>Index of ${req.url}</h1>`);
                        res.write('<ul>');
			// If we are not serving the root directory, create a link to the parent directory
			if (req.url !== '/') {
			    const parentDirectory = path.join(req.url, '..');
			    res.write(`<li><a href="${parentDirectory}">../</a></li>`);
			}
                        files.forEach((file) => {
			    const fileLink = path.join(req.url, file);
                            res.write(`<li><a href="${fileLink}">${file}</a></li>`);
                        });
                        res.write('</ul>');
                        res.write('</body></html>');
                        res.end();

			// Log the response
			console.log(`[RESPONSE]\t${timestamp}\tHTTP/${httpRequestVersion} 200 OK`)
                    }
                });
            } else { // Otherwise, we are serving a file
                // Get the MIME type for the file based on the file extension
                var contentType;
                switch(path.extname(filePath)) {
		case 'bin':
		    contentType = 'application/octet-stream';
		    break;
		case 'bz':
		    contentType = 'application/x-bzip';
		    break;
		case 'gif':
		    contentType = 'image/gif';
		    break;
		case 'gz':
		    contentType = 'application/gzip';
		    break;
		case 'html':
		    contentType = 'text/html';
		    break;
		case 'jar':
		    contentType = 'application/java-archive';
		    break;
                case '.tar.gz':
                    contentType = 'application/x-gzip';
                    break;
                default:
                    contentType = 'text/plain';
                }
		// Create a file stream for the file
		const fileStream = fs.createReadStream(filePath);
		// Handle errors, such as file not found
		fileStream.on('error', (err) => {
		    if (err.code === 'ENOENT') {
			const errorCode = 404
			res.statusCode = errorCode;
			res.end('File not found');
			// Log the error
			console.log(`[ERROR]\t\t${timestamp}\tHTTP/${httpResponseVersion} ${errorCode} ${err.message}`);
		    } else {
			const errorCode = 500
			res.statusCode = errorCode;
			res.end('Internal Server Error');
			// Log the error
			console.log(`[ERROR]\t\t${timestamp}\tHTTP/${httpResponseVersion} ${errorCode} ${err.message}`);
		    }
		});
                // Set the appropriate content type in the response
                res.writeHead(200, {
                    'Content-Type': contentType
                });

		// Pipe the file stream to the response stream
		fileStream.pipe(res);
		// Log the response
		console.log(`[RESPONSE]\t${timestamp}\tHTTP/${httpRequestVersion} 200 OK`)
            }
        }
    });
}).listen(port, () => {
    // Create a timestamp for logging
    const timestamp = new Date().toISOString();
    console.log(`[INFO]\t\t${timestamp}\tServer is now running on ${host}:${port}`);
    console.log(`[INFO]\t\t${timestamp}\tServing files from directory: ${servingDirectory}`);
});
