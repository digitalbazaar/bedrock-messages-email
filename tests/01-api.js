/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */

/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
/* globals describe, before, after, it, should, beforeEach, afterEach */
/* jshint node: true */
/* jshint -W030 */

'use strict';

var _ = require('lodash');
var async = require('async');
var bedrock = require('bedrock');
var brIdentity = require('bedrock-identity');
var brMessages = require('bedrock-messages');
var brPushMessages = require('bedrock-messages-push');
var brMessagesEmail = require('bedrock-messages-email');
var config = bedrock.config;
var database = require('bedrock-mongodb');
var helpers = require('./helpers');
var mockData = require('./mock.data');
var uuid = require('node-uuid').v4;

var store = database.collections.messagesPush;
var userSettings = database.collections.messagesPushUserSettings;

describe('bedrock-messages-email API', function() {
  before(function(done) {
    console.log("%%%%%%%%Preparing databse");
    helpers.prepareDatabase(mockData, done);
  });
  after(function(done) {
    console.log("%%%%%%%removing database")
    helpers.removeCollections(done);
  });
  describe('process function', function() {
    beforeEach(function(done) {
      console.log("%%%%%%beforeEach")
      // Add a mesage to the queue before each test
      var messageId = uuid();

      var body = uuid();
      var holder = uuid();
      var link = uuid();
      var recipient = mockData.identities.rsa4096.identity.id;
      var sender = uuid();
      var subject = uuid();
      var type = uuid();
      var message = helpers.createMessage({
        body: body,
        holder: holder,
        link: link,
        recipient: recipient,
        sender: sender,
        subject: subject,
        type: type
      });
      console.log("%%%%user")
      console.log(recipient);
      async.auto({
        store: function(callback) {
          brMessages.store(message, callback);
        },
        getIdentity: function(callback) {
          console.log("%%%%%%%PULLING IDENTITY");
          console.log(recipient)
          brIdentity.get(null, recipient, callback);
        },
        set: ['getIdentity', 'store', function(callback, results) {
          console.log("%%%%%set");
          console.log(results.getIdentity);
          var o = {
            id: recipient,
            email: {
              enable: true,
              interval: 'daily'
            },
            sms: {
              enable: true,
              interval: 'daily'
            }
          };
          brPushMessages._updateSettings(results.getIdentity[0], o, callback);
        }],
        push: ['set', function(callback) {
          console.log("%%%%%push");
          /*
          var messageEvent = {
            recipient: recipient,
            id: messageId
          };*/
          brPushMessages.queue.add(message, callback);
        }]
      }, done);
    });
    afterEach(function(done) {
      helpers.removeCollections(
        ['messagesPush', 'messagesPushUserSettings'], done);
    });
    it('process one valid email job', function(done) {
      should.exist("hey");
      async.auto({
        process: [function(callback, results) {
          var options = {
            method: 'email',
            interval: 'daily'
          };
          brMessagesEmail.process(options, callback);
        }],
        testResults: ['act', function(callback, results) {
          console.log(results);
          /*
          should.exist(results.act);
          results.act.should.be.an('object');
          var r = results.act;
          should.exist(r.method);
          r.method.should.be.a('string');
          r.method.should.equal('email');
          should.exist(r.recipient);
          r.recipient.should.be.a('string');
          r.recipient.should.equal(user);
          should.exist(r.interval);
          r.interval.should.be.a('string');
          r.interval.should.equal('daily');
          should.exist(r.messages);
          r.messages.should.be.an('array');
          r.messages.should.have.length(1);
          r.messages[0].should.be.a('string');
          r.messages[0].should.equal(messageId);
          */
          callback();
        }],
        checkDatabase: ['act', function(callback) {
          //store.find({id: database.hash(user)}).toArray(callback);
          callback();
        }],
        testDatabase: ['checkDatabase', function(callback, results) {
          /*
          var r = results.checkDatabase[0].value;
          // a lock should have been added to the job
          should.exist(r.meta);
          r.meta.should.be.an('object');
          should.exist(r.meta.lock);
          r.meta.lock.should.be.an('object');
          var lock = r.meta.lock;
          should.exist(lock.id);
          lock.id.should.be.a('string');
          lock.id.should.equal(jobId);
          should.exist(lock.expires);
          lock.expires.should.be.a('number');
          lock.expires.should.be.gt(Date.now());
          */
          callback();
        }]
      }, done);
    });

  });

});
