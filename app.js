require("dotenv").config();
const express = require("express"); // import express module
const bodyParser = require("body-parser"); // import body-paser
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport"); //Passport is an authentication middleware for Node that authenticates requests
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy; // used to set up google auth
const findOrCreate = require("mongoose-findorcreate"); // used with the google auth. find or create a user google id

/*The app object conventionally denotes the Express application.
 Create it by calling the top-level express() function exported by the Express module:
  */
const app = express();

/*serve static files such as images, CSS files, and JavaScript files,
 use the express.static built-in middleware function in Express.
  */
app.use(express.static("public"));

/* This code also sets EJS as the view engine for the Express application using:
This enables res.render() to look in a 'views' folder for the view templates and partials(reusable codes)  */
app.set("view engine", "ejs");

/*this parse an incoming request from the form data, create 'this' body object
and fill it with data. else it will be difficult to manage data
When set to true, then deflated (compressed) bodies will be inflated; when false, deflated bodies are rejected. Defaults to true.
 */
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

//set up session to use express-session
// because it is not secure https yet, we set to false
// If secure is set, and you access your site over HTTP, the cookie will not be set.
app.use(
  session({
    secret: "Our secrets.",
    resave: false,
    saveUninitialized: false,
  })
);

//initialize passport and use session
//passport.initialize() initialises the authentication module.
app.use(passport.initialize());
/*passport.session() is another middleware that alters the request object 
and change the 'user' value that is currently the session id (from the client cookie)
 into the true deserialized user object. */
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
//We define a schema to decide the properties of the object, including default values, data types, if required, etc.
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
/*  passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (user, done) {
    //If using Mongoose with MongoDB; if other you will need JS specific to that schema.
    User.findById(user.id, function (err, user) {
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

app.get("/", function (req, res) {
  res.render("home");
});

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/register", function (req, res) {
  res.render("register");
});

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

//First time registration. authenticate using passport. redirect user to secret page if authenticated else register page
app.post("/register", (req, res) => {
  // register method 'register()' comes from passport local mongoose package.
  // It helps us to handles creating and saving users and interacts with mangoose directly
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        // the function here will only trigger if authnticated by passport
        passport.authenticate("local")(req, res, function () {
          res.redirect("/secrets");
        });
      }
    }
  );
});

// user login using passord and username(email) and redirect to secret page.
app.post("/login", (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/secrets");
      });
    }
  });
});

// Use if user is to login, it finds and render secret page.
app.get("/secrets", function (req, res) {
  User.find({ secret: { $ne: null } }, function (err, foundUsersSecret) {
    //ne means not equal to null
    if (err) {
      console.log(er);
    } else {
      if (foundUsersSecret) {
        res.render("secrets", { UserWithSecrets: foundUsersSecret });
      }
    }
  });

  // if (req.isAuthenticated()){
  //     res.render("secrets");
  // } else {
  //     res.redirect("/login");
  // }
});

app.get("/submit", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.post("/submit", function (req, res) {
  const submittedSecret = req.body.secret;

  User.findById(req.user.id, function (err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.secret = submittedSecret;
        foundUser.save(function () {
          res.redirect("/secrets");
        });
      }
    }
  });
});

// Log out, deauthenticate user and end session.
app.get("/logout", function (req, res) {
  //res.redirect("/");
  //Or
  //req.logout();
  //Or
  res.render("home");
});

app.listen(3000, function () {
  console.log("server started on port 3000.");
});
