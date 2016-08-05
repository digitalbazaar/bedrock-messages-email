/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
/* globals describe, before, after, it, should, beforeEach, afterEach */
/* jshint node: true, -W030 */

'use strict';

var _ = require('lodash');
var async = require('async');
var bedrock = require('bedrock');
var brIdentity = require('bedrock-identity');
var brMessages = require('bedrock-messages');
var brPushMessages = require('bedrock-messages-push');
var brNotifications = require('bedrock-notifications');
var brMessagesEmail = require('bedrock-messages-email');
var config = bedrock.config;
var database = require('bedrock-mongodb');
var helpers = require('./helpers');
var mockData = require('./mock.data');
var uuid = require('uuid').v4;

var store = database.collections.messagesPush;
var userSettings = database.collections.messagesPushUserSettings;

var messageEmailEventType = config['messages-email'].emailEventType;

describe('bedrock-messages-email API', function() {
  describe('process function', function() {
    var recipient = mockData.identities.rsa4096.identity.id;
    var message = null;
    beforeEach(function(done) {
      // Disable event hooks in bedrock-notifications,
      // we'll operate them manually
      brNotifications._unregister(brMessagesEmail);
      brNotifications._setDebugTesting();
      async.auto({
        prepare: function(callback) {
          helpers.prepareDatabase(mockData, callback);
        },
        store: ['prepare', function(callback) {
          var body = uuid();
          var holder = uuid();
          var link = uuid();
          var sender = uuid();
          var subject = uuid();
          var type = uuid();
          message = helpers.createMessage({
            body: body,
            holder: holder,
            link: link,
            recipient: recipient,
            sender: sender,
            subject: subject,
            type: type
          });
          brMessages.store(message, callback);
        }]
      }, done);
    });
    afterEach(function(done) {
      helpers.removeCollections({collections: []}, done);
    });
    it('push one daily email job and process it', function(done) {
      async.auto({
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        set: ['getIdentity', function(callback, results) {
          var o = {
            id: recipient,
            email: {
              enable: true,
              interval: 'daily'
            },
            sms: {
              enable: false,
              interval: 'daily'
            }
          };
          brNotifications._updateSettings(results.getIdentity[0], o, callback);
        }],
        push: ['set', function(callback) {
          brPushMessages.queue.add(message, callback);
        }],
        process: ['push', function(callback, results) {
          var options = {
            method: 'email',
            interval: 'daily'
          };
          brMessagesEmail.process(options, callback);
        }],
        email: ['push', function(callback, results) {
          bedrock.events.on(messageEmailEventType, function(data) {
            // Test will time out if brMessagesEmail.process() does not
            // emit its event properly
            callback(null, data);
          });
        }],
        testResults: ['process', 'email', function(callback, results) {
          should.exist(results.email.type);
          should.exist(results.email.details);
          should.exist(results.email.details.messages);
          should.exist(results.email.details.identity);
          results.email.details.messages.should.be.an('array');
          results.email.details.identity.should.be.an('object');
          results.email.type.should.be.a('string');
          results.email.details.messages.should.be.length(1);

          should.exist(results.process.remove);
          should.exist(results.process.remove.ok);
          results.process.remove.ok.should.equal(1);

          callback(null, results.email);
        }],
        checkDatabase: ['testResults', function(callback, results) {
          store.find({
            id: database.hash(results.testResults.details.identity.id)
          }).toArray(callback);
        }],
        testDatabase: ['checkDatabase', function(callback, results) {
          results.checkDatabase.should.be.an('array');
          results.checkDatabase.should.be.length(0);
          callback();
        }]
      }, done);
    });
    it('push one daily email and one daily sms job, process only email',
      function(done) {
      async.auto({
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        set: ['getIdentity', function(callback, results) {
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
          brNotifications._updateSettings(results.getIdentity[0], o, callback);
        }],
        push: ['set', function(callback) {
          brPushMessages.queue.add(message, callback);
        }],
        process: ['push', function(callback, results) {
          var options = {
            method: 'email',
            interval: 'daily'
          };
          brMessagesEmail.process(options, callback);
        }],
        email: ['push', function(callback, results) {
          bedrock.events.on(messageEmailEventType, function(data) {
            // Test will time out if brMessagesEmail.process() does not
            // emit its event properly
            callback(null, data);
          });
        }],
        testResults: ['process', 'email', function(callback, results) {
          should.exist(results.email.type);
          should.exist(results.email.details);
          should.exist(results.email.details.messages);
          should.exist(results.email.details.identity);
          results.email.details.messages.should.be.an('array');
          results.email.details.identity.should.be.an('object');
          results.email.type.should.be.a('string');
          results.email.details.messages.should.be.length(1);

          should.exist(results.process.remove);
          should.exist(results.process.remove.ok);
          results.process.remove.ok.should.equal(1);

          callback(null, results.email);
        }],
        checkDatabase: ['testResults', function(callback, results) {
          store.find({
            id: database.hash(results.testResults.details.identity.id)
          }).toArray(callback);
        }],
        testDatabase: ['checkDatabase', function(callback, results) {
          // An SMS job should still exist
          results.checkDatabase.should.be.an('array');
          results.checkDatabase.should.be.length(1);

          results.checkDatabase[0].should.be.an('object');
          should.exist(results.checkDatabase[0].value);
          results.checkDatabase[0].value.method.should.equal('sms');
          results.checkDatabase[0].value.recipient.should.equal(recipient);
          results.checkDatabase[0].value.messages.should.be.an('array');
          results.checkDatabase[0].value.messages.should.be.length(1);

          callback();
        }]
      }, done);
    });
    it('push two email jobs for two different recipients', function(done) {
      var recipient2 = mockData.identities.rsa2048.identity.id;
      var message2 = null;
      async.auto({
        secondMessage: function(callback) {
          var body = uuid();
          var holder = uuid();
          var link = uuid();
          var sender = uuid();
          var subject = uuid();
          var type = uuid();
          message2 = helpers.createMessage({
            body: body,
            holder: holder,
            link: link,
            recipient: recipient2,
            sender: sender,
            subject: subject,
            type: type
          });
          brMessages.store(message2, callback);
        },
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        getSecondIdentity: function(callback) {
          brIdentity.get(null, recipient2, callback);
        },
        set: ['getIdentity', function(callback, results) {
          var o = {
            id: recipient,
            email: {
              enable: true,
              interval: 'daily'
            },
            sms: {
              enable: false,
              interval: 'daily'
            }
          };
          brNotifications._updateSettings(results.getIdentity[0], o, callback);
        }],
        set2: ['getSecondIdentity', function(callback, results) {
          var o = {
            id: recipient2,
            email: {
              enable: true,
              interval: 'daily'
            },
            sms: {
              enable: false,
              interval: 'daily'
            }
          };
          brNotifications._updateSettings(
            results.getSecondIdentity[0], o, callback);
        }],
        push: ['set', function(callback) {
          brPushMessages.queue.add(message, callback);
        }],
        push2: ['set2', 'secondMessage', function(callback) {
          brPushMessages.queue.add(message2, callback);
        }],
        process: ['push', 'push2', function(callback, results) {
          var options = {
            method: 'email',
            interval: 'daily'
          };
          brMessagesEmail.process(options, callback);
        }],
        email: ['push', function(callback, results) {
          var eventsReceived = 0;
          var r = {};
          bedrock.events.on(messageEmailEventType, function(data) {
            // Test will time out if brMessagesEmail.process() does not
            // emit its events properly.
            // Because there are two jobs for two diff recipients pushed, we
            // should receive two email events (one for each).
            eventsReceived++;
            if(eventsReceived == 1) {
              r.email1 = data;
            }
            if(eventsReceived == 2) {
              r.email2 = data;
              callback(null, r);
            }
          });
        }],
        testResults: ['process', 'email', function(callback, results) {
          should.exist(results.email.email1.type);
          should.exist(results.email.email1.details);
          should.exist(results.email.email1.details.messages);
          should.exist(results.email.email1.details.identity);
          results.email.email1.details.messages.should.be.an('array');
          results.email.email1.details.identity.should.be.an('object');
          results.email.email1.type.should.be.a('string');
          results.email.email1.details.messages.should.be.length(1);

          should.exist(results.email.email2.type);
          should.exist(results.email.email2.details);
          should.exist(results.email.email2.details.messages);
          should.exist(results.email.email2.details.identity);
          results.email.email2.details.messages.should.be.an('array');
          results.email.email2.details.identity.should.be.an('object');
          results.email.email2.type.should.be.a('string');
          results.email.email2.details.messages.should.be.length(1);

          callback(null, results);
        }],
        checkDatabase: ['testResults', function(callback, results) {
          store.find({id: database.hash(recipient)}).toArray(callback);
        }],
        testDatabase: ['checkDatabase', function(callback, results) {
          results.checkDatabase.should.be.an('array');
          results.checkDatabase.should.be.length(0);

          callback();
        }],
        checkDatabase2: ['testResults', function(callback, results) {
          store.find({id: database.hash(recipient2)}).toArray(callback);
        }],
        testDatabase2: ['checkDatabase2', function(callback, results) {
          results.checkDatabase2.should.be.an('array');
          results.checkDatabase2.should.be.length(0);

          callback();
        }]
      }, done);
    });
    it('push daily email job, remove the recipient identity, and process it',
      function(done) {
      async.auto({
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        set: ['getIdentity', function(callback, results) {
          var o = {
            id: recipient,
            email: {
              enable: true,
              interval: 'daily'
            },
            sms: {
              enable: false,
              interval: 'daily'
            }
          };
          brNotifications._updateSettings(results.getIdentity[0], o, callback);
        }],
        push: ['set', function(callback) {
          brPushMessages.queue.add(message, callback);
        }],
        removeIdentity: ['push', function(callback) {
          helpers.removeCollections({collections: ['identity']}, callback);
        }],
        process: ['removeIdentity', function(callback, results) {
          var options = {
            method: 'email',
            interval: 'daily'
          };
          brMessagesEmail.process(options, callback);
        }],
        testResults: ['process', function(callback, results) {
          should.exist(results.process.remove);
          should.exist(results.process.remove.ok);
          results.process.remove.ok.should.equal(1);

          callback();
        }],
        checkDatabase: ['testResults', function(callback, results) {
          store.find({id: database.hash(recipient)}).toArray(callback);
        }],
        testDatabase: ['checkDatabase', function(callback, results) {
          // Job should be gone from the queue even though .process failed
          results.checkDatabase.should.be.an('array');
          results.checkDatabase.should.be.length(0);
          callback();
        }]
      }, done);
    });
    it('push two email jobs for two recipients, remove a recipient, process',
      function(done) {
      var recipient2 = mockData.identities.rsa2048.identity.id;
      var message2 = null;
      async.auto({
        secondMessage: function(callback) {
          var body = uuid();
          var holder = uuid();
          var link = uuid();
          var sender = uuid();
          var subject = uuid();
          var type = uuid();
          message2 = helpers.createMessage({
            body: body,
            holder: holder,
            link: link,
            recipient: recipient2,
            sender: sender,
            subject: subject,
            type: type
          });
          brMessages.store(message2, callback);
        },
        getIdentity: function(callback) {
          brIdentity.get(null, recipient, callback);
        },
        getSecondIdentity: function(callback) {
          brIdentity.get(null, recipient2, callback);
        },
        set: ['getIdentity', function(callback, results) {
          var o = {
            id: recipient,
            email: {
              enable: true,
              interval: 'daily'
            },
            sms: {
              enable: false,
              interval: 'daily'
            }
          };
          brNotifications._updateSettings(results.getIdentity[0], o, callback);
        }],
        set2: ['getSecondIdentity', function(callback, results) {
          var o = {
            id: recipient2,
            email: {
              enable: true,
              interval: 'daily'
            },
            sms: {
              enable: false,
              interval: 'daily'
            }
          };
          brNotifications._updateSettings(
            results.getSecondIdentity[0], o, callback);
        }],
        push: ['set', function(callback) {
          brPushMessages.queue.add(message, callback);
        }],
        push2: ['set2', 'secondMessage', function(callback) {
          brPushMessages.queue.add(message2, callback);
        }],
        removeIdentity: ['push', 'push2', function(callback) {
          helpers.removeIdentity(recipient, callback);
        }],
        process: ['push', 'push2', function(callback, results) {
          var options = {
            method: 'email',
            interval: 'daily'
          };
          brMessagesEmail.process(options, callback);
        }],
        email: ['push', function(callback, results) {
          bedrock.events.on(messageEmailEventType, function(data) {
            // Test will time out if brMessagesEmail.process() does not
            // emit its events properly.
            callback(null, data);
          });
        }],
        testResults: ['process', 'email', function(callback, results) {
          should.exist(results.email.type);
          should.exist(results.email.details);
          should.exist(results.email.details.messages);
          should.exist(results.email.details.identity);
          results.email.details.messages.should.be.an('array');
          results.email.details.identity.should.be.an('object');
          results.email.type.should.be.a('string');
          results.email.details.messages.should.be.length(1);

          callback(null, results);
        }],
        checkDatabase: ['testResults', function(callback, results) {
          store.find({id: database.hash(recipient)}).toArray(callback);
        }],
        testDatabase: ['checkDatabase', function(callback, results) {
          // Job should no longer exist because we killed its recipient
          results.checkDatabase.should.be.an('array');
          results.checkDatabase.should.be.length(0);

          callback();
        }],
        checkDatabase2: ['testResults', function(callback, results) {
          store.find({id: database.hash(recipient2)}).toArray(callback);
        }],
        testDatabase2: ['checkDatabase2', function(callback, results) {
          results.checkDatabase2.should.be.an('array');
          results.checkDatabase2.should.be.length(0);

          callback();
        }]
      }, done);
    });
  });

});
