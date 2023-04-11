require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy; // used to set up google auth
const findOrCreate = require("mongoose-findorcreate"); // used with the google auth. find or create a user google id

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

//set up session to use express-session
app.use(
  session({
    secret: "Our secrete.",
    resave: false,
    saveUninitialized: false,
  })
);

//initialize passport and use session
app.use(passport.initialize());
app.use(passport.session());

//connection url
const url = "mongodb://127.0.0.1:27017/userDB";

// connect to Database
mongoose
  .connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(function () {
    console.log("Database connected successfully.");
  })
  .catch((err) => console.log(err));
mongoose.set("useCreateIndex", true); // this is to stop deprecation warning for using external library

//create schema i.e the datatype in each column of a model(table like in sql)
const userSchema = new mongoose.Schema({
  email: String, //user's email
  password: String, //users password
  googleId: String, // to help fine user registered with google auth
  secret: String, // save users secret
});

//Hash and salt the password and save in the database. add plugin. This salts and hashs authomatically.
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate); // used for google authentication

passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});

//OR alternatively
/*   passport.serializeUser(function(user, done) {
       done(null, user.id);
     });
  
     passport.deserializeUser(function(id, done) {
       User.findById(id, function(err, user) {
         done(err, user);
       });
     });
*/

//google auth. callbackURL is the Authorized redirect URI. userProfileURL retrieves user password from their google userinfo.
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    //it sends accessToken and user profile which contains user profile id.
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);
      //User.fineOrCreate is not a mongodb syntax but npm function package called mongoose-findorcreate.
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

// sign up with google from the client section on clicking the button. A pop up that allows to sign up.
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] }) // User's profile on google to authenticate
);

//the route we typed on our google dashboard. redirect from 'app.get("/auth/google" ' above.
app.get(
  "/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect to home.
    res.redirect("/secrets");
  }
);
