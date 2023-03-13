/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */


/**
 * Automatically exchange UTS Items on open Sales Orders
 * Runs daily overnight looking at UTS from 2 days before to give time for a change of mind
 * Process a maximum of 4000 sales order lines per run
 */

define(['N/record', 'N/search', 'N/runtime', 'N/crypto', 'N/https'],


    function (record, search, runtime, crypto, https) {


        function execute(scriptContext) {

            // Get Parameters

            var scriptObj = runtime.getCurrentScript();
            var username = scriptObj.getParameter({name: 'custscript_uts_cms_username'});
            var password = scriptObj.getParameter({name: 'custscript_uts_cms_password'});
            var apiKey = scriptObj.getParameter('custscript_uts_neo_apikey');
            var vatItem = scriptObj.getParameter({name: 'custscript_uts_vatitem'});
            var nonVatItem = scriptObj.getParameter({name: 'custscript_uts_nonvatitem'});
            var targetCompany = scriptObj.getParameter({name: 'custscript_uts_target_company'});
            var maxProcess = scriptObj.getParameter({name: 'custscript_uts_max_process'});

            log.debug('Parameters', maxProcess.valueOf())
            var isProduction = runtime.envType === runtime.EnvType.PRODUCTION;

            if (isProduction) {
                var neoPrefix = 'cambium.';
            } else {
                neoPrefix = 'cambium-qa.';
            }

            var cmsPrefix = getPrefix(runtime, true, isProduction);

            // Get list of Items to exchange from SS

            var salesorderSearchColDate = search.createColumn({name: 'trandate', sort: search.Sort.DESC});
            var salesorderSearchColDocumentNumber = search.createColumn({name: 'tranid'});
            var salesorderSearchColInternalId = search.createColumn({name: 'internalid'});
            var salesorderSearchColName = search.createColumn({name: 'entity'});
            var salesorderSearchColAmount = search.createColumn({name: 'amount'});
            var salesorderSearchColItem = search.createColumn({name: 'item'});
            var salesorderSearchColQuantity = search.createColumn({name: 'quantity'});
            var salesorderSearchColQuantityCommitted = search.createColumn({name: 'quantitycommitted'});
            var salesorderSearchColQuantityFulfilledreceived = search.createColumn({name: 'quantityshiprecv'});
            var salesorderSearchColQuantityBilled = search.createColumn({name: 'quantitybilled'});
            var salesorderSearchColType = search.createColumn({name: 'type', join: 'item'});
            var salesorderSearchColTaxSchedule = search.createColumn({name: 'taxschedule', join: 'item'});
            var salesorderSearchColOriginatingListPurchase = search.createColumn({name: 'custcol_originating_list_purchase_id'});
            var salesorderSearchColOwningBrand = search.createColumn({
                name: 'custentity_owning_brand',
                join: 'customer', sort: search.Sort.DESC
            });
            var salesorderSearchColFormulaTextXL4YOPV6 = search.createColumn({
                name: 'formulatext',
                formula: '{customer.entityid}'
            });
            var salesorderSearch = search.create({
                type: 'salesorder',
                filters: [
                    ['type', 'anyof', 'SalesOrd'],
                    'AND',
                    ['mainline', 'is', 'F'],
                    'AND',
                    ['custcol_originating_list_purchase_id', 'isnotempty', ''],
                    'AND',
                    ['item.custitem_bb1_item_status', 'anyof', '7'],
                    'AND',
                    ['formulanumeric: {quantity} - NVL({quantitycommitted}, 0) - NVL ({quantityshiprecv}, 0)', 'greaterthan', '0'],
                    'AND',
                    ['custcol_prob_po_number', 'isempty', ''],
                    'AND',
                    ['purchaseorder.approvalstatus', 'noneof', '2'],
                    'AND',
                    ['customer.custentity_owning_brand', 'anyof', targetCompany]
                ],
                columns: [
                    salesorderSearchColDate,
                    salesorderSearchColDocumentNumber,
                    salesorderSearchColInternalId,
                    salesorderSearchColName,
                    salesorderSearchColAmount,
                    salesorderSearchColItem,
                    salesorderSearchColQuantity,
                    salesorderSearchColQuantityCommitted,
                    salesorderSearchColQuantityFulfilledreceived,
                    salesorderSearchColType,
                    salesorderSearchColTaxSchedule,
                    salesorderSearchColOriginatingListPurchase,
                    salesorderSearchColOwningBrand,
                    salesorderSearchColQuantityBilled,
                    salesorderSearchColFormulaTextXL4YOPV6
                ],
            });

            // Loop through them

            var neoPayload = [];

            var salesOrderSearchResults = salesorderSearch.run();

            var rangeToProcess = salesOrderSearchResults.getRange({
                start: 0,
                end: maxProcess
            });

            log.debug('Processing:', rangeToProcess.length)

            //salesOrderSearchResults.each(function (result) {

            var i  = 0;

            while ( i < rangeToProcess.length) {

                var result = rangeToProcess[i];

                log.debug('Result', result)
                var date = result.getValue(salesorderSearchColDate);
                var documentNumber = result.getValue(salesorderSearchColDocumentNumber);
                var salesOrderId = result.getValue(salesorderSearchColInternalId);
                var customerId = result.getValue(salesorderSearchColName);
                var amount = result.getValue(salesorderSearchColAmount);
                var item = result.getValue(salesorderSearchColItem);
                var itemName = result.getText(salesorderSearchColItem);
                var quantity = result.getValue(salesorderSearchColQuantity);
                var quantityCommitted = result.getValue(salesorderSearchColQuantityCommitted);
                var quantityFulfilledreceived = result.getValue(salesorderSearchColQuantityFulfilledreceived);
                var type = result.getValue(salesorderSearchColType);
                var taxSchedule = result.getValue(salesorderSearchColTaxSchedule);
                var originatingListPurchase = result.getValue(salesorderSearchColOriginatingListPurchase);
                var owningBrand = result.getValue(salesorderSearchColOwningBrand);
                var quantityBilled = result.getValue(salesorderSearchColQuantityBilled);
                var customerListName = result.getValue(salesorderSearchColFormulaTextXL4YOPV6);

                if (taxSchedule == 3) {
                    var vat_rate = 1.2
                    var memoItem = vatItem;
                } else {
                    vat_rate = 1
                    memoItem = nonVatItem;

                }

                log.audit('Processing', result)

                var qtyToRemove = quantity - (quantityCommitted || 0) - (quantityFulfilledreceived || 0);
                var qtyRemaining = quantity - qtyToRemove;
                var unitCreditAmount = (amount / quantity) * vat_rate;
                var amountForSalesOrder = qtyRemaining * (amount / quantity);
                log.debug('Amounts', [quantity, qtyToRemove, qtyRemaining, amountForSalesOrder])

                // Remove from SO

                var forMemo = itemName + ' (' + documentNumber + ')'

                var zeroResult = zeroSalesOrder(salesOrderId, originatingListPurchase, qtyRemaining, item, amountForSalesOrder);

                if (zeroResult === -1) {
                    log.error('Quantity reduction failed', [documentNumber])
                    createContactNote(customerId, 4, itemName + ' was UTS. Attempt to remove from Sales Order ' + documentNumber + ' failed');
                    return
                }

                // Check if billed, determines ig Credit Memo needed

                if (quantityBilled == 0) {

                    // not billed - skip CM

                    log.debug('Not billed, no CM needed', [documentNumber, originatingListPurchase, itemName, qtyToRemove, quantityBilled]);

                    var quantityToCredit = qtyToRemove;
                    var amountToCredit = qtyToRemove * unitCreditAmount;

                } else {

                    // Create credit memo
                    log.debug('Billed, creating CM');

                    if (qtyRemaining > quantityBilled) {

                        quantityToCredit = quantityBilled;
                        amountToCredit = quantityBilled * unitCreditAmount;

                    } else {

                        quantityToCredit = qtyToRemove;
                        amountToCredit = qtyToRemove * unitCreditAmount;

                    }


                    var memoResult = createCreditMemo(customerId, amountToCredit, quantityToCredit, memoItem, forMemo);

                    if (memoResult === -1) {
                        log.error('Memo create failed', [customerId, amountToCredit, quantityToCredit, item, forMemo, customerId]);
                        createContactNote(customerId, 4, itemName + ' was UTS. It has been removed from Sales Order ' + documentNumber + ' but Credit Memo creation failed')
                        return
                    } else {
                        log.audit('Credit Memo created', [memoResult, amountToCredit, item, forMemo, customerId]);
                    }

                }
                // Push exchange back to Neo/CMS

                if (owningBrand == 10 || owningBrand == 11) {

                    //Neo, add to array and push at the end

                    log.debug('Exchanging on Neo', [originatingListPurchase, quantityToCredit, amountToCredit])

                    var itemPayload = {
                        'OrderDetailId': parseInt(originatingListPurchase),
                        'QuantityToCredit': quantityToCredit,
                        'Amount': amountToCredit,
                        'QuantityRemaining': qtyRemaining
                    };

                    //log.debug('Pushing', itemPayload)

                    // neoPayload.push(itemPayload)

                    // FOR TESTING One at a time for now

                    log.debug('Send to Neo (in loop)', itemPayload)

                    var neoResult = exchangeOnNeo([itemPayload], apiKey, neoPrefix, crypto)
                    if (neoResult === -1) {
                        log.error('Neo Exchange failed', neoPayload)
                        createContactNote(customerId, 4, itemName + ' was UTS. It has been removed from Sales Order ' + documentNumber + ' and credit issued in NS of £' + amountToCredit + ' but Neo exchange failed')
                    }


                } else {

                    //CMS

                    log.debug('Exchanging on CMS', owningBrand)

                    var wishlistId = customerListName.substring(1, 8);

                    log.debug('List', [customerId, customerListName, wishlistId])

                    if (quantity == quantityToCredit) {

                        // Try as exchange

                        var cmsResult = exchangeOnCms(originatingListPurchase, username, password, cmsPrefix);

                        log.debug('CMS exchange attempt', cmsResult);

                        if (cmsResult === -1) {
                            log.error('CMS exchange failed', [originatingListPurchase, username, password, cmsPrefix]);

                            // Try again as credit

                            cmsResult = addCmsCredit(wishlistId, amountToCredit, username, password, cmsPrefix);

                            log.debug('CMS credit', cmsResult);

                            if (cmsResult == -1) {
                                log.error('CMS credit add failed', [cmsResult, wishlistId, amountToCredit, username, password, cmsPrefix]);
                                createContactNote(customerId, 4, itemName + ' was UTS. It has been removed from Sales Order ' + documentNumber + ' and credit issued in NS of £' + amountToCredit + ' but CMS credit/exchange failed')
                                return
                            } else {
                                log.audit('CMS credited', [wishlistId, amountToCredit])
                            }

                        } else {

                            log.audit('LP Exchanged', [originatingListPurchase, cmsResult]);

                        }

                    } else {

                        // Add as credit

                        log.audit('No exchange attempted', [quantity, quantityToCredit, originatingListPurchase])

                        cmsResult = addCmsCredit(wishlistId, amountToCredit, username, password, cmsPrefix);

                        log.debug('CMS credit', cmsResult);

                        if (cmsResult == -1) {
                            log.error('CMS credit add failed', [cmsResult, wishlistId, amountToCredit, username, password, cmsPrefix]);
                            createContactNote(customerId, 4, itemName + ' was UTS. It has been removed from Sales Order ' + documentNumber + ' and credit issued in NS of £' + amountToCredit + ' but CMS credit/exchange failed')
                            return
                        } else {
                            log.audit('CMS credited', [wishlistId, amountToCredit])
                        }

                    }

                }

                // Send comms

                createContactNote(customerId, 4, itemName + ' was UTS. It has been removed from Sales Order ' + documentNumber + ' and credit issued of £' + amountToCredit)

                // Do something else? Send e-mail?

                i = i + 1;

                // Must not breach usage limit before sending to Neo

                var remainingUsage = scriptObj.getRemainingUsage();


                if (remainingUsage < 500) {
                    log.audit('Approaching usage limit, ending run', remainingUsage)
                    // send to Neo
                    if (neoPayload != []) {
                        log.debug('Send to Neo (in usage break)', neoPayload)
                        exchangeOnNeo(neoPayload, apiKey, neoPrefix, crypto)
                    }
                    return
                }


            }


//finally send array to Neo


            if (neoPayload != []) {

                log.debug('Final Send to Neo', neoPayload)

                neoResult = exchangeOnNeo(neoPayload, apiKey, neoPrefix, crypto)
                if (neoResult === -1) {
                    log.error('Neo Exchange failed', neoPayload)
                }
            }

            log.audit('Run completed')


        }

        function createCreditMemo(customer, amount, quantity, item, exchangedItemName) {

            var newCM;

            newCM = record.create({
                type: record.Type.CREDIT_MEMO,
                isDynamic: false,
                defaultValues: {
                    entity: customer
                }
            });


            newCM.setValue({
                fieldId: 'memo',
                value: 'Created by automatic exchange on UTC for ' + exchangedItemName
            });

            newCM.setValue({
                fieldId: 'location',
                value: 1
            });

            newCM.insertLine({
                sublistId: 'item',
                line: 0
            });

            newCM.setSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                line: 0,
                value: quantity
            });

            newCM.setSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: 0,
                value: item
            });

            newCM.setSublistValue({
                sublistId: 'item',
                fieldId: 'grossamt',
                line: 0,
                value: amount
            });

            newCM.setSublistValue({
                sublistId: 'item',
                fieldId: 'description',
                line: 0,
                value: exchangedItemName
            });
            try {
                var check = newCM.save();
                log.debug('CM created', check);
                return check;
            } catch (err) {
                log.error('CM Save Failed', err);
                return -1
            }

        }

        function createContactNote(customer, user, noteMessage) {

            var note = record.create({
                type: 'customrecord_contact_notes_entry',
                isDynamic: false
            });

            note.setValue({
                fieldId: 'custrecord_cn_customer',
                value: customer
            });

            note.setValue({
                fieldId: 'custrecord_cn_entry',
                value: noteMessage
            });

            var today = new Date();

            note.setValue({
                fieldId: 'custrecord_cn_date_added',
                value: today
            });

            note.setValue({
                fieldId: 'custrecord_cn_added_by',
                value: user
            });

            try {
                var check = note.save();
                log.debug('Note created', check);
                return check;
            } catch (err) {
                log.error('Note Failed', err);
                return -1
            }
        }

        function exchangeOnCms(lp, username, password, cmsPrefix) {

            var body_json;
            var token;
            var response;
            var url;
            var payload;
            var headers;
            try {

                // Authenticate

                headers = {
                    'Content-Type': 'application/json',
                    'accept': 'application/json'
                };
                payload = {
                    'username': username,
                    'password': password
                };
                url = 'https://' + cmsPrefix + 'prezola.com/api/v2/api-token-auth/';
                response = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(payload)
                });
                log.debug('token response', response);
                body_json = JSON.parse(response.body);
                token = body_json.token;

                //  Add credit
                headers = {
                    'Content-Type': 'application/json',
                    'accept': 'application/json',
                    'Authorization': 'JWT ' + token
                };
                url = 'https://' + cmsPrefix + 'prezola.com/api/v2/listpurchases/' + lp + '/return/';
                payload = {};
                response = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(payload)
                });

                var body = JSON.parse(response.body);
                var new_lp = body.id;

                if (response.code == '201') {
                    log.audit({title: 'LP exchanged, new Lp created', details: new_lp});
                    return new_lp;
                } else {
                    log.error({title: 'Exchange failed', details: response.body});
                    return -1;
                }
            } catch (err) {
                log.error('Exchange failed', err);
                return -1;
            }
        }

        function exchangeOnNeo(payload, key, cmsPrefix, crypto) {
            var response;
            var url;
            var headers;
            var apiKey;

            /*var today = new Date();

            var inputDate = today.getFullYear() + '' +
                ('0' + (today.getMonth() + 1)).slice(-2) + '' +
                ('0' + today.getDate()).slice(-2);

            var hashObj = crypto.createHash({
                algorithm: crypto.HashAlg.SHA256
            });

            hashObj.update({
                input: inputDate
            });

            var hashedValue = hashObj.digest().toLowerCase();*/

            apiKey = key;

            try {
                // Headers
                headers = {
                    'Content-Type': 'application/json',
                    'accept': 'application/json',
                    'x-functions-key': apiKey
                };

                // Endpoint
                url = 'https://' + cmsPrefix + 'azurewebsites.net/api/netsuite/CreditSalesOrdersBatch?code=EFfNTwxgFJHXRki6943t9SKzfQONVHrpScO7dD3GTXX6jy5a2byMIQ==';

                response = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(payload)
                });

                log.audit('Batch url', url);
                log.audit('Batch response', response);

                if (response.code == '200') {
                    log.audit('Batch exchanged, credit applied', payload);
                    return 1;
                } else {
                    log.error({title: 'Exchange failed', details: [response, url, headers]});
                    return -1;
                }
            } catch (err) {
                log.error('Exchange failed', [err, payload]);
                return -1;
            }
        }

        function zeroSalesOrder(salesOrderId, originatingListPurchase, qtyRemaining, itemName, amountRemaining) {

            var salesOrder = record.load({
                type: record.Type.SALES_ORDER,
                id: salesOrderId
            });


            if (originatingListPurchase == '0') {
                var soLine = salesOrder.findSublistLineWithValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: itemName
                });
            } else {
                var soLine = salesOrder.findSublistLineWithValue({
                    sublistId: 'item',
                    fieldId: 'custcol_originating_list_purchase_id',
                    value: originatingListPurchase
                });
            }

            salesOrder.setSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                line: soLine,
                value: qtyRemaining
            });

            salesOrder.setSublistValue({
                sublistId: 'item',
                fieldId: 'amount',
                line: soLine,
                value: amountRemaining
            });

            salesOrder.setSublistValue({
                sublistId: 'item',
                fieldId: 'description',
                line: soLine,
                value: itemName + ' removed due to UTS'
            });

            try {
                var check = salesOrder.save();
                log.audit('SO line reduced', [salesOrderId, originatingListPurchase, soLine, itemName, qtyRemaining]);
            } catch (err) {
                log.error('SO Save Failed', [salesOrderId, err]);
                return -1
            }
            return 1
        }

        function addCmsCredit(cms_id, credit, username, password, cmsPrefix) {

            var url;
            var response;
            var payload;
            var headers;
            try {

                // Authenticate

                headers = {
                    'Content-Type': 'application/json',
                    'accept': 'application/json'
                };
                payload = {
                    'username': username,
                    'password': password
                };
                url = 'https://' + cmsPrefix + 'prezola.com/api/v2/api-token-auth/';
                response = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(payload)
                });
                log.debug('token response', response);
                var body_json = JSON.parse(response.body);
                var token = body_json.token;

                //  Add credit
                headers = {
                    'Content-Type': 'application/json',
                    'accept': 'application/json',
                    'Authorization': 'JWT ' + token
                };
                url = 'https://' + cmsPrefix + 'prezola.com/api/v2/wishlists/' + cms_id + '/credit_voucher/';
                payload = {
                    'amount': credit
                };
                response = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(payload)
                });

                if (response.code == '200') {
                    log.audit('CMS credit, added £' + credit + ' to wishlist ' + cms_id);
                    return 0;
                } else {
                    log.error('Credit add failed', response.body);
                    return -1;
                }
            } catch (err) {
                log.error('Credit add failed', err);
                return -1;
            }
        }

        function getPrefix(runtime, isPrezola, isProduction) {
            if(isProduction){
                if(isPrezola){
                    return getCompanyParameter(runtime, 'custscript_pza_prod_prefix');
                }

                return getCompanyParameter(runtime, 'custscript_neo_prod_prefix');
            }

            if(isPrezola){
                return getCompanyParameter(runtime, 'custscript_pza_qa_prefix');
            }

            return getCompanyParameter(runtime, 'custscript_neo_qa_prefix');
        }

        function getCompanyParameter(runtime, parameter) {
            var script = runtime.getCurrentScript();
            var value = script.getParameter({name: parameter})

            if(value == null)
                return '';

            return value;
        }

        return {
            execute: execute
        };

    }
)
;