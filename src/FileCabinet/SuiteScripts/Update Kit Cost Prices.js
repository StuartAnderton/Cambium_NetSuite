/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */


/**
 * Checks kits for updated cost prices
 */

define(['N/record', 'N/search', 'N/runtime', 'N/format'],


    function (record, search, runtime, format) {


        function execute(scriptContext) {

            var kititemSearchColInternalId = search.createColumn({
                name: 'internalid',
                summary: search.Summary.GROUP,
                sort: search.Sort.DESC
            });
            var kititemSearchColSumOfCostPrices = search.createColumn({
                name: 'formulacurrency',
                summary: search.Summary.SUM,
                formula: '{memberitem.vendorcost} * {memberquantity}'
            });

            var kititemSearchColSuppliersArray = search.createColumn({
                name: 'formulatext',
                summary: search.Summary.MIN,
                formula: 'NS_CONCAT({memberitem.vendor})'
            });

            var kititemSearchColSupplierIdArray = search.createColumn({
                name: 'formulatext',
                summary: search.Summary.MIN,
                formula: 'NS_CONCAT({memberitem.custitem_sup_external_id})'
            });

            var kititemSearchColSupplierBundle = search.createColumn({
                name: 'formulatext',
                summary: search.Summary.MIN,
                formula: 'NS_CONCAT(COALESCE({memberitem.custitem_bundle_rep}, \' \'))'
            });

            var kititemSearchColSupplierBundleCosts = search.createColumn({
                name: 'formulatext',
                summary: search.Summary.MIN,
                formula: 'NS_CONCAT({memberitem.vendorcost})'
            });


            var kititemSearch = search.create({
                type: 'kititem',
                filters: [
                    ['type', 'anyof', 'Kit'],
                ],
                columns: [
                    kititemSearchColInternalId,
                    kititemSearchColSumOfCostPrices,
                    kititemSearchColSuppliersArray,
                    kititemSearchColSupplierIdArray,
                    kititemSearchColSupplierBundle,
                    kititemSearchColSupplierBundleCosts
                ],
            });

            var kititemSearchPagedData = kititemSearch.runPaged({pageSize: 1000});
            for (var i = 0; i < kititemSearchPagedData.pageRanges.length; i++) {
                var kititemSearchPage = kititemSearchPagedData.fetch({index: i});
                kititemSearchPage.data.forEach(function (result) {
                    var internalId = result.getValue(kititemSearchColInternalId);
                    var newSumOfKitPrices = result.getValue(kititemSearchColSumOfCostPrices);
                    var suppliersArray = result.getValue(kititemSearchColSuppliersArray).split(',')
                    var suppliersIdArray = result.getValue(kititemSearchColSupplierIdArray).split(',')
                    var bundleIdArray = result.getValue(kititemSearchColSupplierBundle).split(',')
                    var costsArray = result.getValue(kititemSearchColSupplierBundleCosts).split(',')
                    var supplier = '';
                    var supplierExternalId = '';


                    log.debug("Processing", result);

                    for (var j = 0; j < suppliersArray.length; j++) {
                        if (supplier === '') {
                            supplier = suppliersArray[j];
                        } else {
                            if (supplier != suppliersArray[j]) {
                                supplier = 'Multiple Kit Suppliers';
                                break
                            }
                        }
                    }

                    for ( j = 0; j < suppliersIdArray.length; j++) {
                        if (supplierExternalId === '') {
                            supplierExternalId = suppliersIdArray[j];
                        } else {
                            if (supplierExternalId != suppliersIdArray[j]) {
                                supplierExternalId = 'I7295191';
                                break
                            }
                        }
                    }

                    for ( j = 0; j < bundleIdArray.length; j++) {
                        if (bundleIdArray[j] !== ' ') {
                            newSumOfKitPrices = costsArray[j]
                        }
                    }

                    var kitToProcess = record.load(
                        {
                            type: record.Type.KIT_ITEM,
                            id: internalId
                        }
                    );
                    var currentSumOfCostPrices = kitToProcess.getValue({fieldId: 'custitem_cost_price_from_components'});
                    var currentSupplier = kitToProcess.getValue({fieldId: 'custitem_kit_supplier'});
                    var currentSupplierId = kitToProcess.getValue({fieldId: 'custitem_sup_external_id'});


                    if (currentSumOfCostPrices != newSumOfKitPrices || currentSupplier != supplier || currentSupplierId != supplierExternalId) {
                        kitToProcess.setValue({
                            fieldId: 'custitem_cost_price_from_components',
                            value: newSumOfKitPrices
                        });

                        kitToProcess.setValue({
                            fieldId: 'custitem_kit_supplier',
                            value: supplier
                        });

                        kitToProcess.setValue({
                            fieldId: 'custitem_sup_external_id',
                            value: supplierExternalId
                        });

                        kitToProcess.setValue({
                            fieldId: 'custitem_last_notifiable_update',
                            value: new Date()
                        });
                        kitToProcess.save();
                        log.audit('Updated kit ID ' + internalId, 'Old: ' + [currentSumOfCostPrices, currentSupplier, currentSupplierId] + ' New: ' + [newSumOfKitPrices, supplier, supplierExternalId])


                    }
                });
            }


        }

        return {
            execute: execute
        };

    }
)
;