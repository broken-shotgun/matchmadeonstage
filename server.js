/**
 * This is the main Node.js server script for your project
 * Check out the two endpoints this back-end API provides in fastify.get and fastify.post below
 */

const path = require("path");

// Require the fastify framework and instantiate it
const fastify = require("fastify")({
  // Set this to true for detailed logging:
  logger: false,
});

// ADD FAVORITES ARRAY VARIABLE FROM TODO HERE

// Setup our static files
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/", // optional: default '/'
});

// Formbody lets us parse incoming forms
fastify.register(require("@fastify/formbody"));

// View is a templating manager for fastify
fastify.register(require("@fastify/view"), {
  engine: {
    handlebars: require("handlebars"),
  },
});

fastify.register(require("fastify-socket.io"), {
  // put your options here
});

// Load and parse SEO data
const seo = require("./src/seo.json");
if (seo.url === "glitch-default") {
  seo.url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
}

// votes simply stored as current number in dict by socket id
let votes = {};

/**
 * Our home page route
 *
 * Returns src/pages/index.hbs with data built into it
 */
fastify.get("/", function (request, reply) {
  // params is an object we'll pass to our handlebars template
  let params = { seo: seo };

  // The Handlebars code will be able to access the parameter values and build them into the page
  return reply.view("/src/pages/index.hbs", params);
});

/**
 * Our POST route to handle and react to form submissions
 *
 * Accepts body data indicating the user choice
 */
fastify.post("/", function (request, reply) {
  // Build the params object to pass to the template
  let params = { seo: seo };

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
  return reply.view("/src/pages/index.hbs", params);
});

const sumValues = obj => Object.values(obj).reduce((a, b) => a + b, 0);

fastify.get("/reset", function (request, reply) {
  if (request.query.password === process.env.ADMIN_PASSWORD) {
    votes = {};
    fastify.io.emit('update', 0);
    
    return reply.send({ message: 'Voting successfully reset' });
  }

  return reply.send({ message: 'Requires admin password' });
});

fastify.ready((err) => {
  if (err) throw err

  fastify.io.on('connect', (socket) => {
    console.info('Socket connected!', socket.id);
    
    if (Object.keys(votes).length > 0)
      socket.emit('update', sumValues(votes) / Object.keys(votes).length);
    else
      socket.emit('update', 0);
    
    socket.on('vote', (msg) => {
      console.log('vote: ' + msg);

      const vote = msg === 'hot' ? 1 : -1;
      
      votes[socket.id] = (votes[socket.id] ?? 0) + vote;

      fastify.io.emit('update', sumValues(votes) / Object.keys(votes).length);
      
      console.log(sumValues(votes) / Object.keys(votes).length);
    });
  });
});


// Run the server and report out to the logs
fastify.listen(
  { port: process.env.PORT, host: "0.0.0.0" },
  function (err, address) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
  }
);
