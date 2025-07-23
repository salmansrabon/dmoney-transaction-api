const express = require('express');
const { authenticateJWT, publicAuthenticateJWT } = require('../jwtMiddleware');
const userController = require('../controllers/users/user.controller.js');

const router = express.Router();

router.get('/user/list', publicAuthenticateJWT, userController.listUsers);
router.get('/user/search/id/:id', publicAuthenticateJWT, userController.searchUserById);
router.get('/user/search/phonenumber/:phone_number', publicAuthenticateJWT, userController.searchUserByPhoneNumber);
router.post('/user/search/email', publicAuthenticateJWT, userController.searchUserByEmail);
router.get('/user/search/:role', authenticateJWT, userController.searchUsersByRole);
router.post('/user/create', authenticateJWT, userController.createUser);
router.put('/user/update/:id', authenticateJWT, userController.updateUser);
router.patch('/user/update/:id', authenticateJWT, userController.partialUpdateUser);
router.delete('/user/delete/:id', authenticateJWT, userController.deleteUser);
router.post('/user/login', userController.validateLoginData, userController.loginUser);
router.post('/user/upload/:id', userController.upload, userController.uploadPhoto);
router.get('/user/uploads/:file', userController.retrieveImage);

module.exports = router;
