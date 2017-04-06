const path = require('path');
const os = require('os');
const ScratchOrg = require(path.join(os.homedir(), '.local/share/heroku/plugins/node_modules/salesforce-alm/lib/scratchOrgApi'));
const forceUtils = require('../lib/forceUtils.js');
var forge = require('node-forge');



const fs = require('fs');

(function () {
  'use strict';

  module.exports = {
    topic: 'connectedapp',
    command: 'create',
    description: 'Create a connected app in your org',
    help: 'help text for wadewegner:connectedapp:create',
    flags: [{
        name: 'targetusername',
        char: 'u',
        description: 'username for the target org',
        hasValue: true,
        required: true
      },
      {
        name: 'connectedappname',
        char: 'n',
        description: 'connected app name',
        hasValue: true,
        required: true
      }
    ],
    run(context) {

      const targetUsername = context.flags.targetusername;
      const connectedAppName = context.flags.connectedappname;
      const generatedConsumerSecret = forceUtils.getConsumerSecret();
      const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

      forceUtils.getUsername(targetUsername, (username) => {

        var pki = forge.pki;
        var keys = pki.rsa.generateKeyPair(2048);
        var privKey = forge.pki.privateKeyToPem(keys.privateKey);

        var cert = pki.createCertificate();
        cert.publicKey = keys.publicKey;
        cert.serialNumber = '01';
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
        var attrs = [{
          name: 'commonName',
          value: 'wadewegner.com'
        }, {
          name: 'countryName',
          value: 'US'
        }, {
          shortName: 'ST',
          value: 'Washington'
        }, {
          name: 'localityName',
          value: 'Redmond'
        }, {
          name: 'organizationName',
          value: 'WadeWegner'
        }, {
          shortName: 'OU',
          value: 'WadeWegner'
        }];
        cert.setSubject(attrs);
        cert.setIssuer(attrs);
        cert.setExtensions([{
          name: 'basicConstraints',
          cA: true
        }, {
          name: 'keyUsage',
          keyCertSign: true,
          digitalSignature: true,
          nonRepudiation: true,
          keyEncipherment: true,
          dataEncipherment: true
        }, {
          name: 'extKeyUsage',
          serverAuth: true,
          clientAuth: true,
          codeSigning: true,
          emailProtection: true,
          timeStamping: true
        }, {
          name: 'nsCertType',
          client: true,
          server: true,
          email: true,
          objsign: true,
          sslCA: true,
          emailCA: true,
          objCA: true
        }, {
          name: 'subjectAltName',
          altNames: [{
            type: 6, // URI
            value: 'http://example.org/webid#me'
          }, {
            type: 7, // IP
            ip: '127.0.0.1'
          }]
        }, {
          name: 'subjectKeyIdentifier'
        }]);

        // self-sign certificate
        cert.sign(keys.privateKey);
        var pubKey = pki.certificateToPem(cert);

        fs.writeFile("server.key", privKey, function (err) {
          if (err) {
            return console.log(err);
          }

          console.log("server.key was successfully created!");
        });

        fs.writeFile("server.crt", pubKey, function (err) {
          if (err) {
            return console.log(err);
          }

          console.log("server.cer was successfully created!");
        });

        ScratchOrg.create(username).then(org => {
          org.force._getConnection(org, org.config).then((conn) => {

            const metadata = [{
              contactEmail: username,
              description: 'generated by wadewegner:connectedapp:create',
              fullName: connectedAppName,
              label: connectedAppName,
              oauthConfig: {
                callbackUrl: 'sfdx://success',
                consumerSecret: generatedConsumerSecret,
                certificate: pubKey,
                scopes: [
                  'Basic',
                  'Api',
                  'Web',
                  'Full',
                  'RefreshToken'
                ]
              }
            }];

            conn.metadata.create('ConnectedApp', metadata, (createErr, results) => {
              if (results.success) {

                // console.log(conn.metadata);

                conn.metadata.read('ConnectedApp', connectedAppName, (readErr, metadataResult) => {
                  console.log(metadataResult); // eslint-disable-line no-console

                  // var records = [];
                  // conn.query(`SELECT Id FROM ConnectedApplication WHERE Name = '${connectedAppName}'`, function (err, result) {
                  //   if (err) {
                  //     return console.error(err);
                  //   }
                  //   // console.log(result.records[0].Id);

                  //   const id = result.records[0].Id;

                  //   conn.sobject("ConnectedApplication").update({ 
                  //     Id : id,
                  //     OptionsAllowAdminApprovedUsersOnly : true
                  //   }, function(err, ret) {
                  //     if (err || !ret.success) { return console.error(err, ret); }
                  //     console.log('Updated Successfully : ' + ret.id);
                  //     // ...
                  //   });
                  // });
                });
              } else {
                console.log(results); // eslint-disable-line no-console
              }
            });

          });
        });


        // org.setName(username);
        // org.refreshAuth()
        //   .then(() => org.force._getConnection(org, org.config).then((conn) => {


        //   }));
      });
    }
  };
}());