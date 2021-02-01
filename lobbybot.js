// This example demonstrates the usage of Firebase for storing trigger definitions.
// https://www.firebase.com/docs/
// Before running the example, ensure the following env vars are set:
// FIREBASE_URL, FIREBASE_SECRET
// It is recommended to disable public read/write to your firebase instance

// To run this example:
//npm run-script example-firebase

// Allows you to define environment variables in a .env file located in the root directory of the project
// https://www.npmjs.com/package/dotenv
// Do not ever commit .env
require('dotenv').config({silent: true});

var when = require("when");
var ChatBot = require("nscb").ChatBot;

// Firebase App (the core Firebase SDK) is always required and
// must be listed before other Firebase SDKs
var firebase = require("firebase/app");

// Add the Firebase products that you want to use
require("firebase/auth");
require("firebase/database");
require("firebase/firestore");


var chatBotOptions = {
	disableWebServer: true,
	logFile: true,		//set to true to log to bot.$username.log, or define a custom logfile. Set to false if you don't want to log to file.
	autoConnect: true,
	autoReconnect: true, //automatically reconnect to the server
	consoleTime: false, //don't put timestamps in the console log, `heroku logs` shows them anyways
	consoleColors: false, //don't use colors in the log. using `heroku logs` will be annoying.
	consoleLogLevel: "info", //don't log chatter to console, it's spammy. Only log warnings, errors, etc.
	steamapiKey : ""
};

if(process.env.guardCode) {
	chatBotOptions.guardCode = process.env.guardCode;
}

var username = process.env.username || "";
var password = process.env.password || "";
var fusername = process.env.fusername || "";
var fpassword = process.env.fpassword || "";

var defaultTriggers = require("./triggers.js");

prepareFirebase()
	.then(initBot)
	.catch(function(err) {
		console.error("Error while initializing: ", err);
		process.exit();
});

function prepareFirebase() {
	return when.promise(function(resolve, reject) {	
		var firebaseConfig = {
			apiKey: "AIzaSyDN6Ze6JrNZz9KahnPE7O6J3XocsMs2Y-E",
			authDomain: "csgo-queue.firebaseapp.com",
			databaseURL: "https://csgo-queue-default-rtdb.europe-west1.firebasedatabase.app",
			projectId: "csgo-queue",
			storageBucket: "csgo-queue.appspot.com",
			messagingSenderId: "1053582517720",
			appId: "1:1053582517720:web:2d942709fc6fe6fad0fead",
			measurementId: "G-W1PW4QVVS6"
		};
		console.log("Initializing Firebase");
		// Initialize Firebase
		firebase.initializeApp(firebaseConfig);
		console.log("Attempting to authorize connection");
		firebase.auth().signInWithEmailAndPassword(fusername, fpassword)
		.then((userCredential) => {
			var user = userCredential.user;
			console.log("Firebase login successful.");
			resolve(user);
		})
		.catch((error) => {
			reject(error);
		});
	});
}

function initBot() {
	console.log("Initializing bot");
	var myBot = new ChatBot(username, password, chatBotOptions);
	console.log("Adding triggers");
	myBot.addTriggers(defaultTriggers);
	console.log("Connecting");
	myBot.connect();
}

