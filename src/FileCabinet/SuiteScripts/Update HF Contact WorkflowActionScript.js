/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 */
define(['N/encode', 'N/https', 'N/record', 'N/runtime', 'N/search'],
    /**
 * @param{encode} encode
 * @param{https} https
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 */
    (encode, https, record, runtime, search) => {
        /**
         * Defines the WorkflowAction script trigger point.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.workflowId - Internal ID of workflow which triggered this action
         * @param {string} scriptContext.type - Event type
         * @param {Form} scriptContext.form - Current form that the script uses to interact with the record
         * @since 2016.1
         */
        const onAction = (scriptContext) => {
            const script = runtime.getCurrentScript();
            const apiKey = script.getParameter({name: 'custscript_hf_api_wfa'});
            const authCode = script.getParameter({name: 'custscript_hf_auth_wfa'});

            const customer = scriptContext.newRecord


            const groupCompany = customer.getValue({
                fieldId:'custentity_owning_brand'
            })

            const customerId = customer.getValue({
                fieldId: 'id'
            })



            const customerData = lookupCustomer(customerId)

            log.debug('Customer', customerData)

            if (customerData === -1) {
                return
            }

            log.debug('Sending', [JSON.stringify(customerData), apiKey, authCode])

            const result = sendToHappyfox(customerData, apiKey, authCode)

            log.audit('Updated Contact', [customerId, result])
        }

        return {onAction};

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

        function lookupCustomer(id) {

            log.debug('Processing', [id])

            const customerSearchColInternalId = search.createColumn({name: 'internalid'});
            const customerSearchColPhone = search.createColumn({name: 'phone'});
            const customerSearchColEmail = search.createColumn({ name: 'email' });
            const customerSearchColName = search.createColumn({name: 'entityid', sort: search.Sort.DESC});
            const customerSearchColFullname = search.createColumn({
                name: 'formulatext',
                formula: '{firstname}||\' \'||{lastname}'
            });
            const customerSearchColEventDate = search.createColumn({
                name: 'formulatext',
                formula: 'TO_CHAR({custentity_bb1_event_date}, \'YYYY-MM-DD\')'
            });
            const customerSearchColSecondContactName = search.createColumn({name: 'custentity_bb1_second_contact_name'});
            const customerSearchColNslink = search.createColumn({
                name: 'formulatext',
                formula: '\'https://4970829.app.netsuite.com/app/common/entity/custjob.nl?id=\'||{internalid}'
            });
            const customerSearchColAdmin = search.createColumn({
                name: 'formulatext',
                formula: 'CASE WHEN {custentity_owning_brand} = \'Cambium : Prezola\' THEN \'https://prezola.com/admin/wishlists/wishlist/\'||REGEXP_SUBSTR({entityid}, \'[0-9]+\') ELSE \'https://neo-uk.giftlistmanager.com/GiftList/ListAccount/\'||REGEXP_SUBSTR({entityid}, \'[0-9]+\') END'
            });


            const customerSearch = search.create({
                type: 'customer',
                filters: [
                    ['internalid', 'is', id],
                ],
                columns: [
                    customerSearchColInternalId,
                    customerSearchColPhone,
                    customerSearchColName,
                    customerSearchColFullname,
                    customerSearchColEventDate,
                    customerSearchColSecondContactName,
                    customerSearchColNslink,
                    customerSearchColAdmin,
                    customerSearchColEmail
                ],
            });

            const searchResults = customerSearch.run();
            log.debug('Search result', searchResults)

            var customerData = searchResults.getRange({start: 0, end: 1})[0];

            if (!customerData) {
                log.audit('Not found', id)
                return -1
            }

            const email = customerData.getValue(customerSearchColEmail);
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
        }
    });
