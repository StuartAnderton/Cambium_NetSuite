/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 *
 *
 *
 * Script to calculate and update Item lead times based on actual receipts
 *
 * Gets list of Itesm where current lead time or Supplier lead time does not match the calculated results
 * Gets list of Items where current lead time does not match Supplier lead time
 *
 * Combines the lists and applies logic to decide what needs changing
 *
 * Updates Item records
 *
 *
 *
 */
define(['N/format', 'N/query', 'N/record', 'N/runtime', 'N/search', 'N/file'],
    /**

     */
    (format, query, record, runtime, search, file) => {

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {

            const scriptObj = runtime.getCurrentScript();
            const dummyRun = scriptObj.getParameter({name: 'custscript_dummy_run'});

            // SuiteQL to find average lead times based on actuals
            const fromReceiptsQuery = `
       SELECT
            item,
            vendor_lead,
            item_lead,
            MEDIAN(trandate - ROUND(approved_date) + 1) AS calc_lead,
            custitem_lead_time_type
        FROM (SELECT 
                transaction.tranid,
                transaction.trandate,
                createdfrom.trandate AS approved_date,
                transactionLine.item,
                vendor.custentity_bb1_average_lead_time as vendor_lead,
                item.custitem_av_lead_time AS item_lead,
                transaction.trandate - ROUND(createdfrom.trandate) + 1 AS actual_time,
                item.custitem_lead_time_type,
                RANK() OVER ( PARTITION BY transactionLine.item, transaction.entity ORDER BY transaction.trandate DESC)  AS rank
            FROM transactionLine
               INNER JOIN transaction ON transaction.id = transactionLine.transaction
               INNER JOIN transaction createdfrom ON transactionLine.CreatedFrom = createdfrom.id
               INNER JOIN item ON item.id = item
               INNER JOIN itemvendor ON item.id = itemVendor.item AND preferredVendor = 'T'
               INNER JOIN vendor ON vendor.id = itemVendor.vendor
            WHERE transaction.type = 'ItemRcpt'
                AND createdfrom.custbody_date_approved IS NOT NULL
                AND taxLine = 'F'
                AND mainLine = 'F'
                AND item.isdropshipitem = 'F'
                AND item.isspecialorderitem = 'F'        
                AND createdfrom.trandate >= '01-01-2023' --// the cutoff for PO placement for a receipt to be included   
                AND item.custitem_bb1_item_status != 7
                AND transaction.trandate - ROUND(createdfrom.trandate) + 1 > 0
                AND itemvendor.vendor = createdfrom.entity
            ) data       
        WHERE rank < 5 --// this controls the number of receipts to take into account
        GROUP BY item, item_lead, vendor_lead, custitem_lead_time_type
        HAVING COUNT(tranid) > 2 --// this is the minimum number of receipts to use this calculation
            AND (MEDIAN(trandate - ROUND(approved_date) + 1) !=  item_lead OR MEDIAN(trandate - ROUND(approved_date) + 1) !=  vendor_lead)
            `

            // SuiteQL to get Items where the lead time doesn't match the Supplier Average
            const fromSuppliersQuery = `
                          SELECT 
            item,
            vendor.custentity_bb1_average_lead_time vendor_lead,
            item.custitem_av_lead_time item_lead,
            null AS calc_lead,
            custitem_lead_time_type

        FROM 

               item 
               INNER JOIN itemvendor ON item.id = itemVendor.item AND preferredVendor = 'T'
               INNER JOIN vendor ON vendor.id = itemVendor.vendor
            WHERE 
                         item.isdropshipitem = 'F'
                AND item.isspecialorderitem = 'F'              
                AND item.custitem_bb1_item_status != 7
                AND vendor.custentity_bb1_average_lead_time != item.custitem_av_lead_time

            `

            const fromReceipts = query.runSuiteQL(fromReceiptsQuery)
            const fromReceiptsResults = fromReceipts.asMappedResults();
            log.debug('results', fromReceiptsResults);

            const fromSuppliers = query.runSuiteQL(fromSuppliersQuery)
            const fromSuppliersResults = fromSuppliers.asMappedResults();
            log.debug('Supplier results', fromSuppliersResults.length);

            const mergedItems = [...fromSuppliersResults, ...fromReceiptsResults]

            log.debug('merged', mergedItems.length)

            const mergedDeduped = Object.values(mergedItems.reduce((acc, cur) => {
                if (!acc[cur.item]) {
                    acc[cur.item] = cur;
                } else {
                    acc[cur.item] = {...acc[cur.item], ...cur};
                }
                return acc;
            }, {}));

            log.debug('merged deduped', mergedDeduped.length)

            if (dummyRun) {

                var csvFile = file.create({
                    name: 'merged_deduped.csv',
                    contents: 'item, vendor_lead, item_lead, calc_lead, custitem_lead_time_type, action\n',
                    folder: 2366934,
                    fileType: 'CSV'
                });
            }


            mergedDeduped.forEach(function (result) {

                // Check if marked manual
                if (result.custitem_lead_time_type === 2) {

                    if (dummyRun) {
                        csvFile.appendLine({
                            value: result.item + ',' + result.vendor_lead + ',' + result.item_lead + ',' + result.calc_lead + ',' + result.custitem_lead_time_type + ',"No action- manual"'
                        });
                    } else {
                        return
                    }
                }

                if (result.calc_lead == null) {
                    // no calculated value so use the supplier
                    if (result.item_lead != result.vendor_lead) {
                        //  needed
                        if (dummyRun) {
                            csvFile.appendLine({
                                value: result.item + ',' + result.vendor_lead + ',' + result.item_lead + ',' + result.calc_lead + ',' + result.custitem_lead_time_type + ',"Change to Supplier"'
                            });
                        } else {
                            //the actual record update goes here
                        }

                        return

                    } else {

                        if (dummyRun) {
                            csvFile.appendLine({
                                value: result.item + ',' + result.vendor_lead + ',' + result.item_lead + ',' + result.calc_lead + ',' + result.custitem_lead_time_type + ',"No action - no calc and supplier and item match"'
                            });
                        }

                        return
                    }
                } else {
                    //has calculated value so use that
                    if (result.item_lead != result.calc_lead) {
                        if (dummyRun) {
                            csvFile.appendLine({
                                value: result.item + ',' + result.vendor_lead + ',' + result.item_lead + ',' + result.calc_lead + ',' + result.custitem_lead_time_type + ',"Change to Calc"'
                            });
                        } else {
                            //the actual record update goes here
                        }

                        return

                    } else {
                        if (dummyRun) {
                            csvFile.appendLine({
                                value: result.item + ',' + result.vendor_lead + ',' + result.item_lead + ',' + result.calc_lead + ',' + result.custitem_lead_time_type + ',"No action - calc and item match"'
                            });
                        }

                        return
                    }
                }


            })

            if (dummyRun) {
                // Save the file
                var csvFileId = csvFile.save();
            }

        }

        return {execute}

    });
