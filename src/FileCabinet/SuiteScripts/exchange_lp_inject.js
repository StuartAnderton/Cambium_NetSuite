/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */

// Add credit to Wishlist

define(['N/https', 'N/record', 'N/runtime'],
    function (https, record, runtime) {
        function onRequest(submission) {
            var request = submission.request;

            var cmsPrefix;
            if (runtime.envType === runtime.EnvType.PRODUCTION) {
                cmsPrefix = '';
            } else {
                cmsPrefix = 'matrix.';
            }



            if (request.method === 'POST') {
                try {
                    var params = request.parameters;
                    log.debug('params', params);
                    var querystring = params.entryformquerystring;
                    // var entityIdlist = /.*entityid=(.*)/.exec(querystring);
                    // var entityId = params.entityid;
                    var username = params.username;
                    var password = params.password;
                    // var submitter = params.submitter;
                    //var credit = params.credit;
                    var lp = params.lp;



                    // Get wishlist ID
                    /**

                     customer = record.load({
                        type: record.Type.CUSTOMER,
                        id: entityId
                    });

                     var cms_id = customer.getValue({
                        fieldId: 'externalid'
                    });

                     cms_id = cms_id.substr(1, 8);
                     **/

                        // Authenticate

                    var headers = {
                            'Content-Type': 'application/json',
                            "accept": 'application/json'
                        };
                    var payload = {
                        'username': username,
                        'password': password
                    };
                    var url = 'https://' + cmsPrefix + 'prezola.com/api/v2/api-token-auth/';
                    var response = https.post({
                        url: url,
                        headers: headers,
                        body: JSON.stringify(payload)
                    });
                    log.debug('token response', response);
                    var body_json = JSON.parse(response.body);
                    var token = body_json.token;

                    //  Add credit
                    headers = {
                        'Content-Type': 'application/json',
                        'accept': 'application/json',
                        'Authorization': 'JWT ' + token
                    };
                    // url = 'https://' + cmsPrefix + 'prezola.com/api/v2/wishlists/' + cms_id + '/credit_voucher/';
                    url = 'https://' + cmsPrefix + 'prezola.com/api/v2/listpurchases/' + lp + '/return/';
                    payload = {
                    };
                    response = https.post({
                        url: url,
                        headers: headers,
                        body: JSON.stringify(payload)
                    });
log.debug('Response', response);
var body = JSON.parse(response.body);
var new_lp = body.id;
                    if (response.code == '201') {
                        log.audit('LP ' + lp + ' exchanged, exchange LP ' + new_lp);
                    } else {
                        log.error('Failed', [response.code, response]);
                    }
                } catch (err) {
                    log.error('Failed', err)
                } finally {

                }
            }


        }

        return {
            onRequest: onRequest
        }
    });
