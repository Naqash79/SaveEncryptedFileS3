'use strict';

const AWS = require('aws-sdk');

const S3 = new AWS.S3();
const databaseManager = require('./databaseManager');
const crypto = require('crypto');
const fs = require('fs')
var publicKey = fs.readFileSync('pub.pem', 'utf8')
var privateKey = fs.readFileSync('pri.pem', 'utf8')


var iv = Buffer.from(''); //(null) iv 
var algorithm = 'aes-256-ecb';

exports.SaveFile = (event, context, callback) => {
    switch (event.httpMethod) {

        case 'GET':
            getItem(event, callback);
            break;
        case 'POST':
            saveItem(event, callback);
            break;
        case 'OPTIONS':
            sendResponse(200, JSON.stringify('OPTIONS'), callback);
            break;
        default:
            sendResponse(404, `Unsupported method "${event.httpMethod}"`, callback);
    }
}

function saveItem(event, callback) {

    let request = JSON.parse(event.body);
    let key = request.key;

    let base64String = request.base64String;

    var encryptedFile = encryptFile(base64String, publicKey)
    let params = {
        Key: key,
        Bucket: process.env.BUCKET,
        Body: encryptedFile.file,

    }
    S3.putObject(params)
        .promise()
        .then(result => {
            var item = {
                id: JSON.parse(result['ETag']),
                e_phrase: encryptedFile.phrase,
                file_path: key
            }

            databaseManager.saveItem(item).then(response => {

                sendResponse(200, JSON.stringify({
                    Id: JSON.parse(result['ETag'])
                }), callback);
            });

        })
        .catch(error => {
            sendResponse(400, JSON.stringify(error), callback);
        });



};


function getItem(event, callback) {
    const queryParam = event.queryStringParameters;
    if (queryParam) {
        if (queryParam.Id) {
            databaseManager.getItem(queryParam.Id).then(fileData => {
                if (fileData != null && fileData != undefined) {
                    var params = {
                        Bucket: process.env.BUCKET,
                        Key: fileData.file_path
                    }
                    S3.getObject(params)
                        .promise()
                        .then(data => {
                            var decryptedData = decryptFile(Buffer.from(data.Body).toString('base64'), fileData.e_phrase, privateKey)

                            sendResponse(200, JSON.stringify({
                                key:fileData.file_path,
                                base64String:decryptedData
                                
                            }), callback)
                        }).catch(err => {
                            sendResponse(400, JSON.stringify(err).toString('base64'), callback)
                        });

                } else {
                    sendResponse(400, JSON.stringify("Invalid Id"), callback)

                }
            })

        } else {
            sendResponse(400, JSON.stringify("File Id not found in query parameters"), callback)
        }
    } else {
        sendResponse(400, JSON.stringify("File Id not found in query parameters"), callback)

    }



}


function decryptFile(encryptedData, phrase, privateKey) {

    var buf = Buffer.from(phrase, "base64")

    var decryptedkey = crypto.privateDecrypt(privateKey, buf);
    var password = decryptedkey.toString("base64")
    try {
        let encryptedText = Buffer.from(encryptedData, "base64")
        let decipher = crypto.createDecipheriv(algorithm, Buffer.from(password, "base64"), iv)
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString();
    } catch (e) {
        console.log(e)
    }
}

function encryptFile(input, pubKey) {
    var password = crypto.randomBytes(32);



    var buf = Buffer.from(password)
    var encrypted = crypto.publicEncrypt(pubKey, buf);
    var encryptedString = encrypted.toString("base64")




    var cipher = crypto.createCipheriv(algorithm, Buffer.from(password), iv)
    var crypted = Buffer.concat([cipher.update(Buffer.from(input)), cipher.final()]);
    return {
        file: crypted,
        phrase: encryptedString
    };

}

function sendResponse(statusCode, message, callback) {
    const response = {
        statusCode: statusCode,
        body: message,
        isBase64Encoded: true,
        headers: {
            "X-Requested-With": "*",
            "Accept": 'image/jpeg',
            "Access-Control-Allow-Headers": "Content-Type,Accept,Access-Control-Allow-Headers,Access-Control-Allow-Methods,Access-Control-Allow-Origin,Origin, X-Requested-With,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,Content-Type,Accept,Authorization",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
        },
    };

    callback(null, response);
}
