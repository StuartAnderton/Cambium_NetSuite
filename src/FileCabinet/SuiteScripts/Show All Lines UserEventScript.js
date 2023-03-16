/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record'],
    /**
     * @param{record} record
     */
    (record) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {

        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {

        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {

            var thisRecord = scriptContext.newRecord

            log.debug('Running on', thisRecord)

            const lineCount= thisRecord.getLineCount({
                sublistId: 'item'
            })

            log.debug('Lines', lineCount)

let foundvalue = thisRecord.findSublistLineWithValue({
    sublistId: 'item',
    fieldId: 'item',
    value: 1204238
})
            log.debug('Found', foundvalue)


            for (let i = 0; i < 10; i++) {
                var lineid = thisRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'lineuniquekey',
                    line: i
                })

                const linenumber = thisRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'linenumber',
                    line: lineCount - 1
                })

                var lineitem = thisRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                })

                var linequantity = thisRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i
                })

                log.debug('Line contents line ' + i, [lineid, lineitem, linequantity, linenumber])

            }

        }

        return { afterSubmit}

    });
