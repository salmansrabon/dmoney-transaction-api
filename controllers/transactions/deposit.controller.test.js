const request = require('supertest');
const express = require('express');
const { handleDeposit } = require('./deposit.controller');
const { Users } = require('../../sequelizeModel/Users');
const { Transactions } = require('../../sequelizeModel/Transactions');
const { getBalance } = require('../../services/getBalance');

jest.mock('../../sequelizeModel/Users');
jest.mock('../../sequelizeModel/Transactions');
jest.mock('../../services/getBalance');

const app = express();
app.use(express.json());
app.post('/deposit', handleDeposit);

describe('handleDeposit', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should successfully deposit when all conditions are met', async () => {
        Users.findOne.mockResolvedValue({ getDataValue: () => 'Agent' });
        getBalance.mockResolvedValueOnce(10000).mockResolvedValueOnce(5000);

        const response = await request(app)
            .post('/deposit')
            .send({ from_account: '1234567890', to_account: '0987654321', amount: 1000 });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Deposit successful');
    });

    it('should return 400 if from_account and to_account are the same', async () => {
        const response = await request(app)
            .post('/deposit')
            .send({ from_account: '1234567890', to_account: '1234567890', amount: 1000 });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('From account and to account cannot be the same');
    });

    it('should return 208 if the user is not an agent', async () => {
        Users.findOne.mockResolvedValue({ getDataValue: () => 'Customer' });

        const response = await request(app)
            .post('/deposit')
            .send({ from_account: '1234567890', to_account: '0987654321', amount: 1000 });

        expect(response.status).toBe(208);
        expect(response.body.message).toBe('Only Agent can deposit money');
    });

    it('should return 208 if there is insufficient balance', async () => {
        Users.findOne.mockResolvedValue({ getDataValue: () => 'Agent' });
        getBalance.mockResolvedValueOnce(500);

        const response = await request(app)
            .post('/deposit')
            .send({ from_account: '1234567890', to_account: '0987654321', amount: 1000 });

        expect(response.status).toBe(208);
        expect(response.body.message).toBe('Insufficient balance');
    });

    it('should return 404 if from_account does not exist', async () => {
        Users.findOne.mockResolvedValueOnce(null);

        const response = await request(app)
            .post('/deposit')
            .send({ from_account: '1234567890', to_account: '0987654321', amount: 1000 });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('From Account does not exist');
    });

    it('should return 404 if to_account does not exist', async () => {
        Users.findOne
            .mockResolvedValueOnce({ getDataValue: () => 'Agent' })
            .mockResolvedValueOnce(null);

        const response = await request(app)
            .post('/deposit')
            .send({ from_account: '1234567890', to_account: '0987654321', amount: 1000 });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('To Account does not exist');
    });
});
