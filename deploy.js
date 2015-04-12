var deploy = require("deploy-azure-cdn");
var glob = require("glob");

// load environment variables from .env
if (require("fs").existsSync(".env")) {
  require("dotenv").load();
}

// environment variables
var azure_account = process.env.AZURE_ACCOUNT,
    azure_token   = process.env.AZURE_TOKEN;

// global variables
var logger = console.log;
var opts = {
    serviceOptions: [azure_account, azure_token], // custom arguments to azure.createBlobService
    containerName: null, // container name in blob
    containerOptions: { publicAccessLevel: "blob" }, // container options
    folder: '', // path within container
    deleteExistingBlobs: true, // true means recursively deleting anything under folder
    concurrentUploadThreads: 50, // number of concurrent uploads, choose best for your network condition
    zip: true, // gzip files if they become smaller after zipping, content-encoding header will change if file is zipped
    metadata: { cacheControl: 'public, max-age=31556926' }, // metadata for each uploaded file
    testRun: false // test run - means no blobs will be actually deleted or uploaded, see log messages for details
};

var mapFilesToDeploy = function(files) {
  return files.map(function(item) {
    return {
      cwd: item.substring(0, 3),
      path: item
    };
  });
};

// upload nbs json files
glob("nbs/**/*.json", null, function (er, files) {
  opts.containerName = 'nbs';
  deploy(opts, mapFilesToDeploy(files), logger, function(err){
      if(err) {
          console.log("Error deploying", err);
      }
      console.log('Job\'s done!');
  });
});

// upload ncm json files
// glob("ncm/**/*.json", null, function (er, files) {
//   opts.containerName = 'ncm';
//   deploy(opts, mapFilesToDeploy(files), logger, function(err){
//       if(err) {
//           console.log("Error deploying", err);
//       }
//       console.log('Job\'s done!');
//   });
// });
