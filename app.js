'use strict';

// Load dev environment if not on Bluemix
if (!process.env.VCAP_SERVICES) {
  require('dotenv').load();
}

var vcapServices = JSON.parse(process.env.VCAP_SERVICES);
// console.log(vcapServices.cloudantNoSQLDB[0].credentials);

// Requires
var Cloudant = require('cloudant');
var Follow   = require('follow');
var Watson   = require('watson-developer-cloud');

// Start Cloudant Access
var cloudant = Cloudant({account:vcapServices.cloudantNoSQLDB[0].credentials.username, password:vcapServices.cloudantNoSQLDB[0].credentials.password});
var database = cloudant.db.use(process.env.database);

// Start Personality Insights
var personalityInsights = Watson.personality_insights({
  username: vcapServices.personality_insights[0].credentials.username,
  password: vcapServices.personality_insights[0].credentials.password,
  version: 'v2',
});

// Follow the changes!
Follow({db:vcapServices.cloudantNoSQLDB[0].credentials.url + '/' + process.env.database, include_docs:true}, function(error, change) {
  // If it hasn't errored and the doc hasn't been deleted
  if (!error && !change.deleted) {
    // Only do Personality Insights if a message is attached
    if (change.doc.message && !change.doc.insights) {
      // Messages are likely to be short, just repeat till we reach the bare minimum
      var analyzeText = '';
      for (var i = 0; i < 50; i++) {
        analyzeText += ' ' + change.doc.message;
      };

      // Process through Watson Personality Insights
      personalityInsights.profile({
        text: analyzeText,
        language: 'en', },
        function(err, response) {
          if (err) {
            console.log('error:', err);
          } else {

            // Grab the insights and throw them back into the document
            var insights = response.tree.children;
            change.doc.insights = insights;
            database.insert(change.doc, function(err, body) {
              if (!err)
                console.log(body);
            });
          }
        });
    }

    // Visual Recognition
    if (change.doc.message) {
      console.log('Hello World!');
    }
  }
});
