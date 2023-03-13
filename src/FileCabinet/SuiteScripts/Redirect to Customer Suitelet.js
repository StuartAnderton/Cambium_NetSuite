/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 *
 * Script to redirect to customer based on remote site customer id
 */
define(['N/record', 'N/redirect', 'N/search'],
    /**

     */
    (record, redirect, search) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {


            const params = scriptContext.request.parameters
            let customer = '';
            const site = params.site;
            let prefix = ''

            switch (site) {
                case 'prz':
                    prefix = 'W'
                    break;
                case 'tws':
                    prefix = 'UK'
                    break;
                case 'wpc':
                    prefix = 'WPC'
                    break;
                case 'll':
                    prefix = 'LL'
                    break;
                default:
                    log.error('Site not recognised', params)
                    return
            }

            customer = prefix + params.customer;

            const customerSearch = search.create({
                type: search.Type.CUSTOMER,
                columns: ['internalid'],
                filters: ['externalid', 'is', customer]
            });

            const myResultSet = customerSearch.run();

            const firstResult = myResultSet.getRange({
                start: 0,
                end: 1
            })[0];

            const customerId = firstResult.getValue(myResultSet.columns[0]);

            log.audit('Redirecting', customerId)

            redirect.toRecord({
                type: record.Type.CUSTOMER,
                id: customerId
            })

        }

        return {onRequest}

    });
