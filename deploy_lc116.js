var deploy = require("deploy-azure-cdn");
var glob = require("glob");

// load environment variables from .env
if (require("fs").existsSync(".env")) {
  require("dotenv").load();
}

// environment variables
var azure_account = process.env.AZURE_ACCOUNT,
  azure_token = process.env.AZURE_TOKEN;

// global variables
var logger = () => {};
var opts = {
  serviceOptions: [azure_account, azure_token], // custom arguments to azure.createBlobService
  containerName: null, // container name in blob
  containerOptions: {
    publicAccessLevel: "blob"
  }, // container options
  folder: '', // path within container
  deleteExistingBlobs: false, // true means recursively deleting anything under folder
  concurrentUploadThreads: 2, // number of concurrent uploads, choose best for your network condition
  zip: true, // gzip files if they become smaller after zipping, content-encoding header will change if file is zipped
  metadata: {
    cacheControl: 'public, max-age=31556926'
  }, // metadata for each uploaded file
  testRun: false // test run - means no blobs will be actually deleted or uploaded, see log messages for details
};

var mapFilesToDeploy = function (files) {
  return files.map(function (item) {
    return {
      base: item.substring(0, 3),
      path: item
    };
  });
};

var states = ["ac", "al", "am", "ap", "ba", "ce", "df", "es", "go", "ma", "mg",
  "ms", "mt", "pa", "pb", "pe", "pi", "pr", "rj", "rn", "ro", "rr",
  "rs", "sc", "se", "sp", "to"
];

states.forEach(function (state) {

  // upload ncm json files
  glob("lc116/" + state + "/*.json", null, function (er, files) {
    opts.containerName = 'lc116';
    deploy(opts, mapFilesToDeploy(files), logger, function (err) {
      if (err) {
        console.log('error: lc116 upload job ' + state, err);
      } else {
        console.log('ok: lc116 upload job ' + state);
      }
    });

    console.log('queued lc116 jobs to state ' + state);
  });

});