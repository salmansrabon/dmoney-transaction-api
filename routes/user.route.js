const express = require('express');
const { authenticateJWT, publicAuthenticateJWT } = require('../jwtMiddleware');
const userController = require('../controllers/users/user.controller.js');

const router = express.Router();

router.get('/list', publicAuthenticateJWT, userController.listUsers);
router.get('/search/id/:id', publicAuthenticateJWT, userController.searchUserById);
router.get('/search/phonenumber/:phone_number', publicAuthenticateJWT, userController.searchUserByPhoneNumber);
router.post('/search/email', publicAuthenticateJWT, userController.searchUserByEmail);
router.get('/search/:role', authenticateJWT, userController.searchUsersByRole);
router.post('/create', authenticateJWT, userController.createUser);
router.put('/update/:id', authenticateJWT, userController.updateUser);
router.patch('/update/:id', authenticateJWT, userController.partialUpdateUser);
router.delete('/delete/:id', authenticateJWT, userController.deleteUser);
router.post('/login', userController.validateLoginData, userController.loginUser);
router.post('/upload/:id', userController.upload, userController.uploadPhoto);
router.get('/uploads/:file', userController.retrieveImage);

module.exports = router;
