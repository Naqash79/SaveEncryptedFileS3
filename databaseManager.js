'use strict';

const AWS = require('aws-sdk');
let dynamo = new AWS.DynamoDB.DocumentClient();



module.exports.initializateDynamoClient = newDynamo => {
    dynamo = newDynamo;
};
const TABLE_NAME = process.env.TABLE_NAME
module.exports.saveItem = (item) => {
    const params = {
        TableName: TABLE_NAME,
        Item: item
    };

    return dynamo
        .put(params)
        .promise()
        .then(() => {
            return item;
        });
};

module.exports.getItem = (itemid) => {
    const params = {
        Key: {
            id: itemid
        },
        TableName: TABLE_NAME
    };

    return dynamo
        .get(params)
        .promise()
        .then(result => {
            return result.Item;
        });
};