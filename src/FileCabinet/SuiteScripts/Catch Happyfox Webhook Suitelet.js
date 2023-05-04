/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 *
 *
 *  Catch hook from HappyFox, look up Customer and update Contact
 *
 */
define(['N/https', 'N/record', 'N/runtime', 'N/search', 'N/encode'],
    /**

     */
    (https, record, runtime, search, encode) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {

            const script = runtime.getCurrentScript();
            const apiKey = script.getParameter({name: 'custscript_hf_api'});
            const authCode = script.getParameter({name: 'custscript_hf_auth'});

            log.debug('Request', scriptContext.request)

            const body = JSON.parse(scriptContext.request.body)

            const email = body.email

            const source = body.source

            let groupCompany = ''

            switch (source) {
                case 'WPC Email':
                    groupCompany = '11'
                    break;
                case 'Prezola Email':
                    groupCompany = '9'
                    break;
                default:
                    log.error('Unrecognised source', source)
                    return
            }

            log.debug('Email', email)

            const customerData = lookupCustomer(email, groupCompany)

            log.debug('Customer', customerData)

            if (customerData === -1) {
                return
            }

            log.debug('Sending', [JSON.stringify(customerData), apiKey, authCode])

            const result = sendToHappyfox(customerData, apiKey, authCode)

            log.audit('Updated Contact', [email, result])

        }

        return {onRequest}

        function sendToHappyfox(customerData, apiKey, authCode) {

            var auth_string = apiKey + ':' + authCode;

            log.debug('auth string', auth_string)

            var hexEncodedString = encode.convert({
                string: auth_string,
                inputEncoding: encode.Encoding.UTF_8,
                outputEncoding: encode.Encoding.BASE_64
            });

            var headers = {'Authorization': 'Basic ' + hexEncodedString};

            log.debug('Headers', headers)

            var url = 'https://prezola.happyfox.com/api/1.1/json/users/';

            var response = https.post({
                url: url,
                headers: headers,
                body: customerData
            });

            log.debug('Response', response)

            return response.code

        }

        function lookupCustomer(email, groupCompany) {

            log.debug('Processing', [email, groupCompany])

            const customerSearchColInternalId = search.createColumn({name: 'internalid'});
            const customerSearchColPhone = search.createColumn({name: 'phone'});
            const customerSearchColName = search.createColumn({name: 'entityid', sort: search.Sort.DESC});
            const customerSearchColFullname = search.createColumn({
                name: 'formulatext',
                formula: '{firstname}||\' \'||{lastname}'
            });
            const customerSearchColEventDate = search.createColumn({
                name: 'formulatext',
                formula: 'TO_CHAR({custentity_bb1_event_date}, \'YYYY-MM-DD\')'
            });
            const customerSearchColSecondContactName = search.createColumn({ name: 'custentity_bb1_second_contact_name' });
            const customerSearchColNslink = search.createColumn({ name: 'formulatext', formula: '\'https://4970829.app.netsuite.com/app/common/entity/custjob.nl?id=\'||{internalid}' });
            const customerSearchColAdmin = search.createColumn({ name: 'formulatext', formula: 'CASE WHEN {custentity_owning_brand} = \'Cambium : Prezola\' THEN \'https://prezola.com/admin/wishlists/wishlist/\'||REGEXP_SUBSTR({entityid}, \'[0-9]+\') ELSE \'https://neo-uk.giftlistmanager.com/GiftList/ListAccount/\'||REGEXP_SUBSTR({entityid}, \'[0-9]+\') END' });


            const customerSearch = search.create({
                type: 'customer',
                filters: [
                    ['custentity_owning_brand', 'anyof', groupCompany],
                    'AND',
                    ['email', 'is', email],
                ],
                columns: [
                    customerSearchColInternalId,
                    customerSearchColPhone,
                    customerSearchColName,
                    customerSearchColFullname,
                    customerSearchColEventDate,
                    customerSearchColSecondContactName,
                    customerSearchColNslink,
                    customerSearchColAdmin
                ],
            });

            const searchResults = customerSearch.run();
            log.debug('Search result', searchResults)

            var customerData = searchResults.getRange({start: 0, end: 1})[0];

            if (!customerData) {
                log.audit('Email not found', email)
                return -1
            }

            const internalId = customerData.getValue(customerSearchColInternalId);
            const phone = customerData.getValue(customerSearchColPhone);
            const name = customerData.getValue(customerSearchColName);
            const fullname = customerData.getValue(customerSearchColFullname);
            const eventDate = customerData.getValue(customerSearchColEventDate);
            const partner = customerData.getValue(customerSearchColSecondContactName);
            const nsLink = customerData.getValue(customerSearchColNslink);
            const adminLink = customerData.getValue(customerSearchColAdmin);

            return {
                'email': email,
                'name': fullname,
                'phones': [{
                    'type': 'm',
                    'number': phone,
                    'is_primary': true
                }],
                'c-cf-1': name,
                'c-cf-9': eventDate,
                'c-cf-10': adminLink,
                'c-cf-50': nsLink,
                'c-cf-51': partner

            }

            /*                 */


        }

    });
