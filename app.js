var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const trackRoute = express.Router();
const videoRoute = express.Router();
const multer = require('multer');
const mongodb = require('mongodb');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const url = require('./config/config').MongoDB.url;
/**
 * NodeJS Module dependencies.
 */
const { Readable } = require('stream');

var app = express();

//view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res) {
  res.render('index')
})

app.use('/tracks', trackRoute);
app.use('/videos', videoRoute);

/**
 * Connect Mongo Driver to MongoDB.
 */
var db ;
MongoClient.connect(url,{ useNewUrlParser: true}, (err, database) => {
  if (err) {
    console.log('MongoDB Connection Error. Please make sure that MongoDB is running.');
    process.exit(1);
  }
  console.log("connected db");
  
  db = database.db('qcuong-test2'); // have to use mongodb@2.2.33 in order to pass database to multer ( db=database )
  // mongo3.1 need you to specify the database although it already declared in the url above
});

/**
 * GET /tracks/:trackID
 */
trackRoute.get('/:trackID',async (req, res) => {
  try {
          let bucket =  new mongodb.GridFSBucket(db, {
            bucketName: 'tracks'
          });
          var trackID =  new ObjectID(req.params.trackID);
          let filesQuery = await db.collection("tracks.files").find({ _id: trackID }).toArray();
          let fileSize =  filesQuery[0].length;
          let range =  req.headers.range;
            if(range) { 
                  console.log('vao if');
                  
                  const parts =  range.replace(/bytes=/, "").split("-")
                  const start =  parseInt(parts[0], 10)
                  
                  const end =  parts[1]
                        ? parseInt(parts[1], 10)
                        : fileSize-1
                  console.log(end);
                  
                  const chunkSize =  (end-start)+1
                  const head =  {
                  'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                  'Accept-Ranges': 'bytes',
                  'Content-Length':  chunkSize,
                  'Content-Type': 'audio/mp3',
                  }

                  res.writeHead(206,head)

                  let downloadStream = bucket.openDownloadStream(trackID,{start,end});

                  downloadStream.on('data', (chunk) => {
                    res.write(chunk);
                  });

                  downloadStream.on('error', () => {
                    res.sendStatus(404);
                  });

                  downloadStream.on('end', () => {
                    res.end();
                  });
            }
            else {
              console.log('vao else');
              const head = {
                'Content-Length': fileSize,
                'Content-Type': 'audio/mp3',
              }
              res.writeHead(200, head)
              let downloadStream =  bucket.openDownloadStream(trackID);

              downloadStream.pipe(res);

              downloadStream.on('error', () => {
                res.sendStatus(404);
              });

              downloadStream.on('end', () => {
                res.end();
              });
              
            }
  } 
  catch(err) {
    console.log(err);
  }
              
});

/**
 * POST /tracks
 */
trackRoute.post('/', (req, res) => {
  
  
  
  const storage = multer.memoryStorage()
  const upload = multer({ storage: storage, limits: { fields: 1, fileSize: 6000000, files: 1, parts: 2 }});
  
  upload.single('track')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: "Upload Request Validation Failed" });
    } else if(!req.body.name) {
      return res.status(400).json({ message: "No track name in request body" });
    }
    console.log(req.body.name);
    
    let trackName = req.body.name;
    
    // Covert buffer to Readable Stream
    const readableTrackStream = new Readable();
    readableTrackStream.push(req.file.buffer);
    readableTrackStream.push(null);

    let bucket = new mongodb.GridFSBucket(db, {
      bucketName: 'tracks'
    });

    let uploadStream = bucket.openUploadStream(trackName);
    let id = uploadStream.id;
    readableTrackStream.pipe(uploadStream);

    uploadStream.on('error', () => {
      return res.status(500).json({ message: "Error uploading file" });
    });

    uploadStream.on('finish', () => {
      return res.status(201).json({ message: "File uploaded successfully, stored under Mongo ObjectID: " + id });
    });
  });
});





/**
 * GET /video/:videoID
 */
videoRoute.get('/:videoID', async (req, res) => {
  try {
      let bucket =  new mongodb.GridFSBucket(db, {
        bucketName: 'videos'
      });
      let range =  req.headers.range;
      var videoID =  new ObjectID(req.params.videoID);
          // console.log(fileSize);

      if(range) { 
            console.log('vao if');
            let filesQuery = await db.collection("videos.files").find({ _id: videoID }).toArray();
            let fileSize =  filesQuery[0].length;

            const parts =  range.replace(/bytes=/, "").split("-")
            const start =  parseInt(parts[0], 10)           
            const end =  parts[1]
                  ? parseInt(parts[1], 10)
                  : fileSize-1

            const chunkSize =  (end-start)+1
            const head =  {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length':  chunkSize,
            'Content-Type': 'video/mp4',
            }           
            res.writeHead(206,head)

            let downloadStream = bucket.openDownloadStream(videoID,{start,end});
            
            downloadStream.pipe(res);

            downloadStream.on('error', () => {
              res.sendStatus(404);
            });

            downloadStream.on('end', () => {
              res.end();
            });
      }
      else {
            let filesQuery = await db.collection("videos.files").find({ _id: videoID }).toArray();
            let fileSize =  filesQuery[0].length;
            console.log('vao else');
            const head = {
              'Content-Length': fileSize,
              'Content-Type': 'video/mp4',
            }
            res.writeHead(200, head)
            let downloadStream =  bucket.openDownloadStream(videoID);

            downloadStream.pipe(res);

            downloadStream.on('error', () => {
              res.sendStatus(404);
            });

            downloadStream.on('end', () => {
              res.end();
            }); 
      }

  } 
  catch(err) {
    console.log(err);
  }
    

});

      
/**
 * POST /video
 */
videoRoute.post('/', (req, res) => {
  
  
  const storage = multer.memoryStorage()
  const upload = multer({ storage: storage, limits: { fields: 1, fileSize: 60000000, files: 1, parts: 2 }});
  
  upload.single('video')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: "Upload Request Validation Failed" });
    } else if(!req.body.name) {
      return res.status(400).json({ message: "No video name in request body" });
    }
    console.log(req.body.name);
    
    let videoName = req.body.name;
    
    // Covert buffer to Readable Stream
    const readableVideoStream = new Readable();
    readableVideoStream.push(req.file.buffer);
    readableVideoStream.push(null);

    let bucket = new mongodb.GridFSBucket(db, {
      bucketName: 'videos'
    });

    let uploadStream = bucket.openUploadStream(videoName);
    let id = uploadStream.id;
    readableVideoStream.pipe(uploadStream);

    uploadStream.on('error', () => {
      return res.status(500).json({ message: "Error uploading file" });
    });

    uploadStream.on('finish', () => {
      return res.status(201).json({ message: "File uploaded successfully, stored under Mongo ObjectID: " + id });
    });
  });
});






// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
