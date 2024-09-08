const express = require('express');
const router = express.Router();
const defaultController= require('../controllers/default/default.controller.js')

router.get('/', defaultController.serverStatus);
module.exports = router;
