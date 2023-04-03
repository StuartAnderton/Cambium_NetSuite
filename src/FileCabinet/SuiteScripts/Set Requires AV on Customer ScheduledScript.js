/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/record', 'N/search'],
    /**

 */
    (record, search) => {

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {

            let salesorderSearchColName = search.createColumn({ name: 'entity', summary: search.Summary.GROUP });
            let salesorderSearch = search.create({
                type: 'salesorder',
                filters: [
                    ['type', 'anyof', 'SalesOrd'],
                    'AND',
                    ['status', 'anyof', 'SalesOrd:E', 'SalesOrd:D', 'SalesOrd:B'],
                    'AND',
                    ['mainline', 'is', 'F'],
                    'AND',
                    ['taxline', 'is', 'F'],
                    'AND',
                    ['item.custitem_age_verification_needed', 'is', 'T'],
                    'AND',
                    ['formulanumeric: NVL({quantitycommitted}, 0)', 'greaterthan', '0'],
                    'AND',
                    ['customer.custentity_age_verified_delivery', 'is', 'F'],
                ],
                columns: [
                    salesorderSearchColName,
                ],
            });

            salesorderSearch.run().each(function (result) {

                log.debug('Line', result)

                var customer = result.getValue(salesorderSearchColName)

                log.debug('Updating Customer to TRUE', customer)


                var customerRecord = record.load({
                    type: record.Type.CUSTOMER,
                    id: customer
                })

                customerRecord.setValue({
                    fieldId: 'custentity_age_verified_delivery',
                    value: true
                })

                var savedCustomer = customerRecord.save()

                log.audit('Updated Customer to TRUE', savedCustomer)

                return true

            });

            // look for ones where can remove the checkbox

            salesorderSearchColName = search.createColumn({ name: 'entity', summary: search.Summary.GROUP });
            salesorderSearch = search.create({
                type: 'salesorder',
                filters: [
                    ['type', 'anyof', 'SalesOrd'],
                    'AND',
                    ['mainline', 'is', 'F'],
                    'AND',
                    ['taxline', 'is', 'F'],
                    'AND',
                    ['item.custitem_age_verification_needed', 'is', 'T'],
                    'AND',
                    ['customer.custentity_age_verified_delivery', 'is', 'T'],
                    'AND',
                    ['sum(formulanumeric: CASE WHEN NVL({quantitycommitted}, 0) >  0 THEN 1 ELSE 0 END)', 'equalto', '0'],
                ],
                columns: [
                    salesorderSearchColName,
                ],
            });

            salesorderSearch.run().each(function (result) {

                log.debug('Line', result)

                var customer = result.getValue(salesorderSearchColName)

                log.debug('Updating Customer to FALSE', customer)


                var customerRecord = record.load({
                    type: record.Type.CUSTOMER,
                    id: customer
                })

                customerRecord.setValue({
                    fieldId: 'custentity_age_verified_delivery',
                    value: false
                })

                var savedCustomer = customerRecord.save()

                log.audit('Updated Customer to FALSE', savedCustomer)

                return true

            });



        }

        return {execute}

    });
