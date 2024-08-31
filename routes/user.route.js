const express = require('express');
const { authenticateJWT, publicAuthenticateJWT } = require('../jwtMiddleware');
const userController = require('../controllers/users/user.controller.js');

const router = express.Router();

router.get('/', userController.serverStatus);
router.get('/list', publicAuthenticateJWT, userController.listUsers);
router.get('/search/id/:id', publicAuthenticateJWT, userController.searchUserById);
router.get('/search/phonenumber/:phone_number', authenticateJWT, userController.searchUserByPhoneNumber);
router.get('/search/email/:email', authenticateJWT, userController.searchUserByEmail);
router.get('/search/:role', authenticateJWT, userController.searchUsersByRole);
router.post('/create', authenticateJWT, userController.createUser);
router.put('/update/:id', authenticateJWT, userController.updateUser);
router.patch('/update/:id', authenticateJWT, userController.partialUpdateUser);
router.delete('/delete/:id', authenticateJWT, userController.deleteUser);
router.post('/login', userController.validateLoginData, userController.loginUser);
router.post('/upload/:id', userController.upload, userController.uploadPhoto);

module.exports = router;
