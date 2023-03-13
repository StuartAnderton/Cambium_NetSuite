/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/record', 'N/search'],
    /**

 */
    (record, search) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {

            const request = scriptContext.request;
            const params = request.parameters;
            const id = params.exId;
            let location = {};

            const itemSearchColLocationAvailable = search.createColumn({ name: 'locationquantityavailable', summary: search.Summary.SUM });
            const itemSearch = search.create({
                type: 'item',
                filters: [
                    ['externalid', 'anyof', id],
                    'AND',
                    ['location', 'anyof', '1'],
                ],
                columns: [
                    itemSearchColLocationAvailable,
                ],
            });

            const itemSearchResultSet = itemSearch.run();

            const result = itemSearchResultSet.getRange({start: 0, end: 1})[0];

            const locationAvailable = result.getValue(itemSearchColLocationAvailable);

            location.locationName = 'Swindon 1';
            location.locationId = 1;
            location.quantity = locationAvailable;

            scriptContext.response.write({output: JSON.stringify(location)})


        }

        return {onRequest}

    });
