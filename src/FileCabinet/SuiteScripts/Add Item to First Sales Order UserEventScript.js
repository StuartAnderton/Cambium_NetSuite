/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 *
 *
 * Adds an item to the first SO created for a customer
 *
 */
define(['N/record', 'N/runtime', 'N/search'],
    /**

     */
    (record, runtime, search) => {

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {

            //if(scriptContext.type !== scriptContext.UserEventType.CREATE) {return}

            var thisRecord = scriptContext.newRecord

            // set to Swindon1 location id
            const location = '1'

            const scriptObj = runtime.getCurrentScript();
            const appliesToBrand = scriptObj.getParameter({name: 'custscript_1stso_applies_to'});
            const itemToAdd = scriptObj.getParameter({name: 'custscript_1stso_item'});
            const itemQuantity = scriptObj.getParameter({name: 'custscript_1stso_quantity'});

            log.debug('Params', [appliesToBrand, itemToAdd, itemQuantity])

            // See if an SO already exists for this Customer

            const customer = thisRecord.getValue({
                fieldId: 'entity'
            })

            const owningBrand = thisRecord.getValue({
                fieldId: 'custbody_owning_brand'
            })

            log.debug('Brand check', [owningBrand, appliesToBrand])

            if (owningBrand !== appliesToBrand) {
                log.audit('Not processed due to Owning Brand', thisRecord)
                return false}

            const thisLocation = thisRecord.getValue({
                fieldId: 'location'
            })

            log.debug('Location check', [thisLocation, location])

            if (thisLocation !== location)  {
                log.audit('Not processed due to Location', thisRecord)
                return}

            log.debug('Processing', [customer, owningBrand])

            const salesorderSearchColInternalId = search.createColumn({name: 'internalid'});
            const salesorderSearch = search.create({
                type: 'salesorder',
                filters: [
                    ['type', 'anyof', 'SalesOrd'],
                    'AND',
                    ['name', 'anyof', customer],
                    'AND',
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['location', 'anyof', location],
                ],
                columns: [
                    salesorderSearchColInternalId,
                ],
            });

            const soResults = salesorderSearch.run()

            const results = soResults.getRange({
                start: 0,
                end: 1000
            });

            const soCount = results.length

            log.debug('SO count', soCount)

            if (soCount !== 0) {
                return
            }


            // add item

            const itemsInRecord = thisRecord.getLineCount({
                sublistId: 'item'
            })

            thisRecord.insertLine({
                sublistId: 'item',
                line: itemsInRecord
            })

            thisRecord.setSublistValue({
                sublistId: 'item',
                line: itemsInRecord,
                fieldId: 'item',
                value: itemToAdd
            })

            thisRecord.setSublistValue({
                sublistId: 'item',
                line: itemsInRecord,
                fieldId: 'quantity',
                value: itemQuantity
            })

            thisRecord.setSublistValue({
                sublistId: 'item',
                line: itemsInRecord,
                fieldId: 'amount',
                value: 0
            })

            thisRecord.setSublistValue({
                sublistId: 'item',
                line: itemsInRecord,
                fieldId: 'location',
                value: location
            })

            thisRecord.setSublistValue({
                sublistId: 'item',
                line: itemsInRecord,
                fieldId: 'description',
                value: 'Automatically added to first order'
            })

            thisRecord.setSublistValue({
                sublistId: 'item',
                line: itemsInRecord,
                fieldId: 'custcol_gross_amount_entry',
                value: 0
            })


        }


        return {beforeSubmit}

    });
