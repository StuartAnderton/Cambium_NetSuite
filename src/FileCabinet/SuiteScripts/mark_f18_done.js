/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */

// Mark F18 as done

define(['N/search', 'N/record', 'N/redirect'],
    function (search, record, redirect) {
        function onRequest(context) {


            var request = context.request;

            var customer_id = request.parameters.customer_id;

            var search_name = request.parameters.search_name;

            var done_flag = request.parameters.done_flag;

            log.debug('Processing', [customer_id, search_name, done_flag] );

            var customer = record.load({
                type: record.Type.CUSTOMER,
                id: customer_id
            });

            customer.setValue({
                fieldId: done_flag,
                value: true,
                ignoreFieldChange: true
            });

            recordId = customer.save();

            log.debug('Saved', recordId );

            redirect.toSavedSearchResult({id: search_name});

        }

        return {
            onRequest: onRequest
        }
    });
