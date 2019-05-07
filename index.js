const express = require("express");
const app = express();
const http = require("http");
const bodyParser = require('body-parser');
const exphbs = require('express-handlebars');
const path = require('path');
const mongoose = require("mongoose");
const flash = require('connect-flash');
const session = require('cookie-session');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const methodOverride = require('method-override');
const { ensureAuthenticated } = require('./helpers/auth');
require('./models/Idea');
require('./models/User');
const User = mongoose.model('users');
const Idea = mongoose.model('ideas');
const port = process.env.PORT || 3002;

setInterval(function () {
  http.get("http://sleepy-fortress-90126.herokuapp.com/");
}, 300000);

app.listen(port);
app.engine('handlebars', exphbs({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');

app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true
}))

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

app.use(function (req, res, next) {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  next();
})

// Устанавливаем корневую директорию для статических файлов

app.use('/public', express.static(path.join(__dirname, 'views/public/')))





// Соединение с базой

mongoose.connect('mongodb+srv://Ally:mq8hvz7zy@notes-5en3g.mongodb.net/test?retryWrites=true', {
  useNewUrlParser: true
})
  .then(() => console.log('MongoDB connected!'))
  .catch(error => console.log(error));


// Парсер тела запроса

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

// Перепись методов

app.use(methodOverride('_method'));

// проверка логина

app.post('/users/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/ideas',
    failureRedirect: '/users/login',
    failureFlash: true
  })(req, res, next)
});

passport.use(new LocalStrategy({
  usernameField: 'email',
  passReqToCallback: true
},
  (req, email, password, done) => {
    User.findOne({ email: email })
      .then(user => {
        if (!user) {
          return done(null, false, { message: 'Такого пользователя не существует' })
        }
        //  Сравниваем пароли
        bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err) throw err;
          if (isMatch) {
            return done(null, user)
          }
          else {
            return done(null, false, { message: 'Пароль не совпадает' })
          }
        })

      })
  }
));


passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user)
  });
});

// Проверка регистрации

app.post('/users/register', (req, res) => {

  let errors = [];
  if (req.body.pass !== req.body['repeat-pass']) {
    errors.push({ text: 'Пароли не совпадают' });
  }

  if (req.body.pass.length < 4) {
    errors.push({ text: 'Пароль должен быть не менее 4-х символов' })
  }

  if (errors.length > 0) {
    res.render('users/register', {
      errors: errors,
      name: req.body.name,
      email: req.body.email
    })
  }

  else {
    const newUser = {
      name: req.body.name,
      email: req.body.email,
      password: req.body.pass,
    }

    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(newUser.password, salt, (err, hash) => {
        newUser.password = hash;
        User.findOne({ email: newUser.email })
          .then((user) => {

            if (user) {
              errors.push({ text: 'пользователь с такой почтой уже существует' })
              res.render('users/register', {
                errors: errors
              })
            }
            else {
              new User(newUser).save()
                .then(user => {
                  res.redirect('/users/login');
                })
            }
          })
      })
    })
  }
})


// Добавляем форму

app.post('/ideas', ensureAuthenticated, function (req, res) {

  let errors = [];
  if (!req.body.title) {
    errors.push({ text: 'добавьте заголовок' })
  }
  if (!req.body.detailes) {
    errors.push({ text: 'добавьте описание' });
  }
  if (errors.length > 0) {
    res.render('ideas/add', {
      errors: errors,
    });
  }
  else {
    const note = {
      title: req.body.title,
      detailes: req.body.detailes,
      user: req.user.id
    }
    new Idea(note).save()
      .then(idea => {
        res.redirect('/ideas')
      })
  }
});

app.get('/ideas/add', ensureAuthenticated, function (req, res) {
  res.render('ideas/add');
});


app.get('/ideas/edit/:id', ensureAuthenticated, (req, res) => {

  Idea.findOne({
    _id: req.params.id
  })
    .then(idea => {

      if (idea.user != req.user.id) {
        req.flash('error_msg', 'Вы не авторизированы');
        res.redirect('/ideas')
      }
      else {
        res.render('ideas/edit', {
          idea: idea
        })
      }
    })

})


app.put('/ideas/:id', ensureAuthenticated, (req, res) => {
  Idea.findOne({
    _id: req.params.id
  })
    .then(idea => {
      idea.title = req.body.title;
      idea.detailes = req.body.detailes;
      idea.save()
        .then(() => {
          req.flash('success_msg', 'Запись была отредактирована');
          res.redirect('/ideas')
        })
    })
});



//Удаляем заметку из базы данных

app.delete('/ideas/:id', ensureAuthenticated, (req, res) => {
  Idea.remove({
    _id: req.params.id
  })
    .then(
      () => {
        req.flash('success_msg', 'Запись была удалена');
        res.redirect('/ideas')
      }
    )
})


// Создаем страницы


app.get('/', function (req, res) {
  res.render('root');
});


app.get('/users/login', (req, res) => {
  res.render('users/login');
})


app.get('/logout', function (req, res) {
  req.logout();
  req.flash('success_msg', "Вы вышли");
  res.redirect('/users/login');
})


app.get('/users/register', (req, res) => {
  res.render('users/register');
})


app.get('/about', function (req, res) {
  res.render('about');
})

app.get('/ideas', ensureAuthenticated, function (req, res) {


  Idea.find({ user: req.user.id })
    .sort({ date: 'desc' })
    .then(ideas => {
      res.render('ideas/index', {
        ideas: ideas
      })
    })

})


app.use(function (req, res) {
  res.render('error')
});



