/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */

// Update Delivery date of  Wishlist

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

            var username = runtime.getCurrentScript().getParameter('custscript_usernamedd');
            var password = runtime.getCurrentScript().getParameter('custscript_passworddd');

            if (request.method === 'POST') {
                try {
                    var params = request.parameters;
                    log.debug('params', params);
                    var querystring = params.entryformquerystring;
                    var entityId = params.entityid;
                    var day = params.day;
                    var month = params.month;
                    var year = params.year;
                    var cms_id = params.cmsid;


                        // Authenticate

                    var token = authenticate(username, password, cmsPrefix);


                    //  Change Delivery Date

                    var result = setCmsDD(cms_id, day, month, year, token, cmsPrefix);


                    if (result.code == '200') {
                        log.audit('Delivery Date Updated', [cms_id, day, month, year]);
                    } else {
                        log.error('Date Update failed', result.body)
                    }
                } catch (err) {
                    log.error('Delivery Date Update failed', err)
                } finally {
                    submission.response.sendRedirect({
                        type: https.RedirectType.RECORD,
                        identifier: record.Type.CUSTOMER,
                        id: entityId
                    });
                }
            }
        }

        function setCmsDD(cmsId, day, month, year, token, cmsPrefix) {

            var result;

            //day = day - 1;
            //var newDeliveryDate = new Date(year, day, month);
            var headers = {
                'Content-Type': 'application/json',
                'accept': 'application/json',
                'X-HTTP-METHOD-OVERRIDE': 'patch',
                'Authorization': 'JWT ' + token
            };
            var url = 'https://' + cmsPrefix + 'prezola.com/api/v2/wishlists/' + cmsId + '/';
            var payload = {
                'cmsId': cmsId,
                'delivery_date': year + '-' + month + '-' +  day,
                'token': token,
                'cmsPrefix': cmsPrefix
            };
            log.debug('Payload', payload);

            try {
                result = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(payload)
                });
                log.debug('Response', result);
            } catch (err) {
                log.error('Error', [cmsId, day, month, year, token, cmsPrefix, err]);
                return {code: 500}
            }

            return result
        }

        function authenticate(username, password, cmsPrefix) {

            var headers = {
                'Content-Type': 'application/json',
                "accept": 'application/json'
            };
            var payload = {
                'username': username,
                'password': password
            };
            log.debug('Auth payload', payload);
            var url = 'https://' + cmsPrefix + 'prezola.com/api/v2/api-token-auth/';

            var response = https.post({
                url: url,
                headers: headers,
                body: JSON.stringify(payload)
            });

            var body_json = JSON.parse(response.body);
            var token = body_json.token;
            return token;
        }

        return {
            onRequest: onRequest
        }
    });
