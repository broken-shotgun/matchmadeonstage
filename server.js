// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD0Kr5GAyn8dryNSYPiYogX9Xwe3BnGf5E",
  authDomain: "match-made-on-stage.firebaseapp.com",
  projectId: "match-made-on-stage",
  storageBucket: "match-made-on-stage.firebasestorage.app",
  messagingSenderId: "43496683708",
  appId: "1:43496683708:web:d8c87f15d58b4b578778b9",
  measurementId: "G-P9BSKCXKMC"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);

import path from "path";
import { fileURLToPath } from 'url';

// init sqlite db
import fs from "fs";
const dbFile = "./.data/votes.db";
const exists = fs.existsSync(dbFile);
import sqlite3 from "sqlite3";
const db = new sqlite3.Database(dbFile);

// if ./.data/votes.db does not exist, create it, otherwise print recent records to console
db.serialize(() => {
  if (!exists) {
    db.run(
      "CREATE TABLE Votes (date TEXT PRIMARY KEY, votes INTEGER)"
    );
    console.log("New table Votes created!");
  } else {
    console.log('Database "Votes" ready to go!');
    db.each("SELECT * from Votes ORDER BY date DESC LIMIT 25", (err, row) => {
      if (row) {
        console.log(`${row.date}> ${row.votes}`);
      }
    });
  }
});

const getDateKey = () => {
  const now = new Date();
  const options = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  };
  return now.toLocaleDateString('en-US', options);
}

const loadVotes = (dateKey) => {
  db.get(`SELECT votes from Votes WHERE date = '${dateKey}' ORDER BY date DESC LIMIT 1`, (err, rows) => {
    if (rows) {
      votes = rows[0]?.votes ?? 0;
    }
  });
}

const updateVotes = (votes) => {
  const voteDate = getDateKey();
  console.log(voteDate, votes);
  
  db.run('INSERT INTO Votes (date, votes) VALUES (?,?) ON CONFLICT(date) DO UPDATE SET votes=excluded.votes', voteDate, votes, error => {
    if (error) {
      console.error(`Error updating votes from ${voteDate}: ${error}`);
    }
  });
}

// Require the fastify framework and instantiate it
import { fastify } from "fastify";
const app = fastify({
  // Set this to true for detailed logging:
  // logger: false,
  trustProxy: true, // https://fastify.dev/docs/latest/Guides/Serverless/#google-cloud-run
});

import { fastifyStatic } from "@fastify/static";
import { fastifyFormbody } from "@fastify/formbody";
import { fastifyView } from "@fastify/view";
import fastifySocketPkg from "fastify-socket.io";
import handlebarsPkg from "handlebars";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

// Setup our static files
app.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/", // optional: default '/'
});

// Formbody lets us parse incoming forms
app.register(fastifyFormbody);

// View is a templating manager for fastify
app.register(fastifyView, {
  engine: {
    handlebars: handlebarsPkg,
  },
});

app.register(fastifySocketPkg, {
  // put your options here
  cors: {
    origin: ['https://www.matchmadeonstage.com', 'https://match-made-on-stage-server--match-made-on-stage.us-central1.hosted.app']
  }
});

// Load and parse SEO data
// import seo from './src/seo.json' with { type: 'json' }; 
// if (seo.url === "glitch-default") {
//   seo.url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
// }

// votes simply stored as number
let votes = 0;
loadVotes(getDateKey()); // load from DB

/**
 * Our home page route
 *
 * Returns src/pages/index.hbs with data built into it
 */
app.get("/", function (request, reply) {
  // params is an object we'll pass to our handlebars template
  // let params = { seo: seo };

  // The Handlebars code will be able to access the parameter values and build them into the page
  return reply.view("/src/pages/index.hbs");
});

app.get("/results", function (request, reply) {
  // params is an object we'll pass to our handlebars template
  // let params = { seo: seo };

  // The Handlebars code will be able to access the parameter values and build them into the page
  return reply.view("/src/pages/results.hbs");
});

/**
 * Our POST route to handle and react to form submissions
 *
 * Accepts body data indicating the user choice
 */
app.post("/", function (request, reply) {
  // Build the params object to pass to the template
  // let params = { seo: seo };

//   // If the user submitted a color through the form it'll be passed here in the request body
//   let color = request.body.color;
//   // If it's not empty, let's try to find the color
//   if (color) {
//     // ADD CODE FROM TODO HERE TO SAVE SUBMITTED FAVORITES
//     // Load our color data file
//     const colors = require("./src/colors.json");
//     // Take our form submission, remove whitespace, and convert to lowercase
//     color = color.toLowerCase().replace(/\s/g, "");
//     // Now we see if that color is a key in our colors object
//     if (colors[color]) {
//       // Found one!
//       params = {
//         color: colors[color],
//         colorError: null,
//         seo: seo,
//       };
//     } else {
//       // No luck! Return the user value as the error property
//       params = {
//         colorError: request.body.color,
//         seo: seo,
//       };
//     }
//   }

  // The Handlebars template will use the parameter values to update the page with the chosen color
  return reply.view("/src/pages/index.hbs");
});

app.get("/reset", function (request, reply) {
  if (request.query.password === process.env.ADMIN_PASSWORD) {
    votes = 0;
    updateVotes(votes);
    
    app.io.emit('update', 0);
    
    return reply.send({ message: 'Voting successfully reset' });
  }

  return reply.send({ message: 'Requires admin password' });
});

app.ready((err) => {
  if (err) throw err

  app.io.on('connect', (socket) => {
    console.info('Socket connected!', socket.id);
    
    socket.emit('update', votes);
    
    socket.on('vote', (msg) => {
      console.log('vote: ' + msg);

      const vote = msg === 'hot' ? 1 : -1;
      
      votes += vote;
      
      if (votes < -10) votes = -10;
      if (votes > 100) votes = 100;

      app.io.emit('update', votes);
      
      updateVotes(votes);
    });
    
    socket.on('ask_question', (msg) => {
      console.log('vote: ' + msg);
//       const vote = msg === 'hot' ? 1 : -1;
//       fastify.io.emit('update', votes);
    });
  });
});


// Run the server and report out to the logs
const IS_GOOGLE_CLOUD_RUN = process.env.K_SERVICE !== undefined;
const port = IS_GOOGLE_CLOUD_RUN ? 8080 : process.env.PORT || 8080; 
const host = IS_GOOGLE_CLOUD_RUN ? "0.0.0.0" : undefined;
app.listen(
  { port: port, host: host },
 (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
  }
);
