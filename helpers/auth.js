module.exports = {
	ensureAuthenticated: function (req, res, next) {
		if (req.isAuthenticated()) {
			return next();
		}

		req.flash('error_msg', 'Вы не авторизированы');
		res.redirect('/users/login');
	}
}