const express = require('express');
const router = express.Router();
const userController = require('../controllers/users/user.controller.js');

router.get('/', userController.serverStatus);
module.exports = router;
