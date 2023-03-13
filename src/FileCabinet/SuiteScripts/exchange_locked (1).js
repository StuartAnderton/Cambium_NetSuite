/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */

//  Exchanges a locked item on a sales order


define(['N/record', 'N/ui/serverWidget', 'N/ui/message', 'N/runtime', 'N/https', 'N/redirect', 'N/crypto'],
    function (record, serverWidget, message, runtime, https, redirect, crypto) {
        function onRequest(context) {

            var scriptObj;
            var username;
            var password;
            var apiKey;
            var userObj;
            var userId;
            var user;
            var soItem;
            var cmsPrefix;
            var isPrezola;

            if (runtime.envType === runtime.EnvType.PRODUCTION) {
                cmsPrefix = '';
            } else {
                cmsPrefix = 'matrix.';
            }

            scriptObj = runtime.getCurrentScript();
            username = scriptObj.getParameter({name: 'custscript_cms_username'});
            password = scriptObj.getParameter({name: 'custscript_cms_password'});
            apiKey = runtime.getCurrentScript().getParameter('custscript_neo_apikey');
            var vatItem = scriptObj.getParameter({name: 'custscript_vatitem'});
            var nonVatItem = scriptObj.getParameter({name: 'custscript_nonvatitem'});

            userObj = runtime.getCurrentUser();
            userId = userObj.id;
            user = userObj.email;

            log.audit({title:'Exchange for credit being run by: ' + user});

            if (context.request.method === 'GET') {

                //Display confirmation form

                var request = context.request;
                var params = request.parameters;
                var line_num = params.line - 1;
                var id = params.soid;
                var amount = params.amount;
                var quantity = params.quantity;
                var neo_reorder = params.exc;
                var soId = id.match(/(.*)_/)[1];
                var item = params.item;
                var taxcode = params.taxcode;

                var customer = getCustomerFromSalesOrder(soId);
                isPrezola = isExchangeForPrezola(customer);

                //var customer_id = request.parameters.customer_id;


                var form = serverWidget.createForm({
                    title: 'Exchange Item',
                    hideNavBar: false
                });

                var msg = 'Exchange ' + params.name + ' for credit. \n' +
                    'Change quantity or amount if required.\n' +
                    'Amount will be recalculated automatically if you change quantity.';
                var warning = 'You are about to exchange a Sales Order line for credit. Click Exchange to continue, or hit Back to cancel.';

                form.addPageInitMessage({type: message.Type.WARNING, message: warning});

                var explain = form.addField({
                    id: 'custpage_text',
                    type: serverWidget.FieldType.TEXT,
                    label: 'About to exchange'
                });
                explain.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.INLINE
                });
                explain.defaultValue = msg;

                var salesorder = form.addField({
                    id: 'custpage_salesorder',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Sales Order'
                });
                salesorder.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });
                salesorder.defaultValue = soId;

                var soAmount = form.addField({
                    id: 'custpage_amount',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Amount'
                });
                soAmount.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });
                soAmount.defaultValue = amount;

                var taxCode = form.addField({
                    id: 'custpage_taxcode',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Taxcode'
                });
                taxCode.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });
                taxCode.defaultValue = taxcode;

                soItem = form.addField({
                    id: 'custpage_item',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Item'
                });
                soItem.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });
                soItem.defaultValue = item;

                var soItemName = form.addField({
                    id: 'custpage_item_name',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Item Name'
                });
                soItemName.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });
                soItemName.defaultValue = params.name;

                var soQuantityField = form.addField({
                    id: 'custpage_quantity',
                    type: serverWidget.FieldType.INTEGER,
                    label: 'Original Quantity'
                });
                soQuantityField.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });
                soQuantityField.defaultValue = quantity;

                var soNewQuantity = form.addField({
                    id: 'custpage_new_quantity',
                    type: serverWidget.FieldType.INTEGER,
                    label: 'Quantity to exchange'
                });
                soNewQuantity.updateLayoutType({
                    layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW
                });
                soNewQuantity.defaultValue = quantity;

                var soNewAmount = form.addField({
                    id: 'custpage_new_amount',
                    type: serverWidget.FieldType.CURRENCY,
                    label: 'Amount to Credit'
                });
                soNewAmount.updateLayoutType({
                    layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW
                });
                soNewAmount.defaultValue = amount;

                if(!isPrezola){
                    soNewAmount.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });
                }

                var so_line = form.addField({
                    id: 'custpage_so_line',
                    type: serverWidget.FieldType.INTEGER,
                    label: 'Sales Order Line'
                });
                so_line.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });
                so_line.defaultValue = line_num;

                var neo_reorder_line = form.addField({
                    id: 'custpage_neo_reorder',
                    type: serverWidget.FieldType.INTEGER,
                    label: 'Neo exchange'
                });
                neo_reorder_line.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });
                neo_reorder_line.defaultValue = neo_reorder;

                form.addSubmitButton({
                    label: 'Exchange'
                });

                context.response.writePage(form);

            } else {

                // Process return from confirmation form

                request = context.request;

                var html = '';

                params = request.parameters;

                soId = params.custpage_salesorder;
                var soLine = params.custpage_so_line;
                var oldAmount = params.custpage_amount;
                var newAmount = params.custpage_new_amount;
                var oldQuantity = params.custpage_quantity;
                var newQuantity = params.custpage_new_quantity;
                var itemSku = params.custpage_item;
                var itemName = params.custpage_item_name;
                var itemTaxcode = params.custpage_taxcode;
                var neoReorder = params.custpage_neo_reorder;

                var customer = getCustomerFromSalesOrder(soId);
                isPrezola = isExchangeForPrezola(customer);

                log.debug('Processing', [soId, soLine, newAmount, oldAmount, newQuantity, oldQuantity, itemSku]);

                //do checks

                if (newAmount > oldAmount || newAmount <= 0 || newQuantity > oldQuantity || newQuantity <= 0) {

                    log.error('Invalid entry', [newAmount, oldAmount, newQuantity, oldQuantity]);
                    html = 'Invalid amount/quantity. Nothing processed.';
                    context.response.write(html);
                    return
                }

                var salesOrder = record.load({
                    type: record.Type.SALES_ORDER,
                    id: soId
                });

                if (!salesOrder) {
                    log.error('Sales Order not loaded', [soId]);
                    html = 'Failed, nothing processed';
                    context.response.write(html);
                    return
                }

                /* soItem = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: soLine
                });
                */

                if (itemTaxcode == 'VAT:S-GB') {
                    soItem = vatItem;
                } else {
                    soItem = nonVatItem;
                }

                var soQuantity = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: soLine
                });

                if (soQuantity == 0) {
                    log.error('Zero quantity returned', [soQuantity]);
                    html = 'Failed, nothing processed';
                    context.response.write(html);
                    return
                }

                var soQuantityBilled = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantitybilled',
                    line: soLine
                }) || 0;

                var soGrossAmount = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_gross_amount_entry',
                    line: soLine
                });
              
              if(soGrossAmount == ""){
                soGrossAmount = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'grossamt',
                    line: soLine
                });
              }

                var soLp = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_originating_list_purchase_id',
                    line: soLine
                });

                var soDescription = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'description',
                    line: soLine
                });

                if (oldAmount != soGrossAmount) {
                    log.error('Amount mismatch', [oldAmount, soGrossAmount]);
                    html = 'Failed. Nothing processed.';
                    context.response.write(html);
                    return
                }

                var customerId = salesOrder.getValue({
                    fieldId: 'entity'
                });

                var customerExternalId = customer.getValue({
                    fieldId: 'entityid'
                });

                var wishlistId;

                if(isPrezola){
                    wishlistId = customerExternalId.match(/^W(.{8})/)[1];

                    if (!wishlistId) {
                        log.error('Wishlist not found', [customerId, customerExternalId]);
                        html = 'Failed. Nothing processed.';
                        context.response.write(html);
                        return
                    }
                }

                log.debug('Loaded', [customerId, customerExternalId, wishlistId, soItem, soQuantity, soQuantityBilled, soGrossAmount]);

                // Check if billed

                if (soQuantityBilled == 0) {

                    // not billed - skip CM
                    log.debug('Not billed, no CM needed');

                    var quantityToCredit = newQuantity;
                    var amountToCredit = newAmount;
                    var notBilled = true;


                } else {
                    // Create credit memo
                    log.debug('Billed, create CM');

                    if (newQuantity > soQuantityBilled) {

                        quantityToCredit = soQuantityBilled;

                    } else {

                        quantityToCredit = newQuantity;

                    }


                    // in case of partial billing


                    if (oldAmount == newAmount) {

                        amountToCredit = soGrossAmount * (quantityToCredit / soQuantity);

                    } else {
                        amountToCredit = newAmount;
                    }

                    var memoResult = createCreditMemo(customerId, amountToCredit, quantityToCredit, soItem, itemName, user);

                    if (memoResult == -1) {
                        log.error('Memo create failed', [customerId, amountToCredit, quantityToCredit, soItem, itemName, user]);
                        html = 'Failed, nothing processed';
                        context.response.write(html);
                        return
                    } else {
                        log.audit('Credit Memo created', [memoResult, amountToCredit, soItem, itemName]);
                    }
                }

                // Change SO Line amount


                // if not billed, and partial credit

                if (soQuantityBilled == 0 && newAmount != oldAmount) {


                    if (soQuantity - quantityToCredit == 0) {

                        var quantityLeft = 1;

                    } else {

                        quantityLeft = soQuantity - quantityToCredit;

                    }

                    var amountToSet = soGrossAmount - amountToCredit;

                  
                  salesOrder.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_gross_amount_entry',
                        line: soLine,
                        value: amountToSet
                    });
                  
                  salesOrder.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'grossamt',
                        line: soLine,
                        value: amountToSet
                    });

                } else {

                    quantityLeft = soQuantity - quantityToCredit;

                }


                salesOrder.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: soLine,
                    value: quantityLeft
                });
              
              salesOrder.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        line: soLine,
                        value: 0
                    });

                try {
                    var check = salesOrder.save();
                    log.audit('SO line zeroed', [check, soLine]);
                } catch (err) {
                    log.error('SO Save Failed', err);
                    html = 'Failed, but credit memo created';
                    context.response.write(html);
                    return
                }

                // Add credit to CMS

                //try as exchange

                var doneAsExchange = false;

                if (((isPrezola && soQuantity == quantityToCredit && oldAmount == newAmount) || !isPrezola) && soLp != '') {

                    var cmsResult;

                    log.audit({title:'isPza', details:isPrezola});
                    
                    if (isPrezola)
                        cmsResult = exchangeOnCms(soLp, username, password, cmsPrefix);
                    else {
                      var itemPrice = soGrossAmount / soQuantity;
                      
                      log.audit('itemPrice', itemPrice);
                      
                        cmsResult = creditOrReorderOnNeo(salesOrder, soDescription, runtime, amountToCredit, quantityToCredit, itemPrice, neoReorder, itemName, itemSku, apiKey, soLp, soLine, crypto);
                    }

                    log.debug('CMS exchange attempt', cmsResult);

                    if (cmsResult == -1) {
                        log.error('CMS exchange failed', [soLp, username, password, cmsPrefix]);
                    } else {
                        log.audit('lp Exchanged', [soLp, cmsResult]);
                        doneAsExchange = true;
                    }
                } else {

                    log.audit('No exchange attempted', [soQuantity, quantityToCredit, soLp])

                }

                if(isPrezola) {

                    if (!doneAsExchange) {

                        cmsResult = addCmsCredit(wishlistId, amountToCredit, username, password, cmsPrefix);

                        log.debug('CMS credit', cmsResult);

                        if (cmsResult == -1) {
                            log.error('CMS credit add failed', [cmsResult, wishlistId, amountToCredit, username, password, cmsPrefix]);
                            html = 'Failed, but credit memo created and line zeroed. No credit added to CMS.';
                            context.response.write(html);
                            return
                        } else {
                            log.audit('CMS credited', [wishlistId, amountToCredit])
                        }
                    }


                    if (doneAsExchange) {

                        if (notBilled) {
                            var noteMessage = 'Credit against Item ' + itemSku + ' (' + itemName + '): LP ' + soLp + ' exchanged on CMS, not billed so no NS credit needed';
                        } else {

                            noteMessage = 'Credit against Item ' + itemSku + ' (' + itemName + '): LP ' + soLp + ' exchanged on CMS, Credit created on NS for £' + amountToCredit;
                        }
                    } else {
                        if (notBilled) {
                            noteMessage = 'Credit against Item ' + itemSku + ' (' + itemName + '): LP LP NOT exchanged, manual credit created on CMS, not billed so no NS credit needed';
                        } else {
                            noteMessage = 'Credit against Item ' + itemSku + ' (' + itemName + '): LP NOT exchanged, manual credit created on CMS, Credit on NS for £' + amountToCredit;
                        }
                    }

                    var noteResult = createContactNote(customerId, userId, noteMessage);
    
    
                    if (noteResult == -1) {
                        log.error('Note add failed', [customerId, user, noteMessage]);
                        html = 'Failed to add note, but all done.';
                        context.response.write(html);
                        return
                    } else {
                        log.audit('Note created', [customerId, user, noteMessage])
                    }
                }


                redirect.toRecord({
                    type: record.Type.SALES_ORDER,
                    id: check
                });
            }
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
                    log.audit({title:'LP exchanged, new Lp created', details:new_lp});
                    return new_lp;
                } else {
                    log.error({title:'Exchange failed', details:response.body});
                    return -1;
                }
            } catch (err) {
                log.error('Exchange failed', err);
                return -1;
            }
        }

        function GetNeoOrderHeaderId(description){
            return description
                .replace("Order Detail: ", "")
                .replace(" Order Header: ", "|")
                .split("|")[1];
        }

        function creditOrReorderOnNeo(salesOrder, soDescription, runtime, amountToCredit, quantityToCredit, itemPrice, neoReorder, itemName, itemSku, apiKey, soLp, soLine, crypto){

            var cmsPrefix;

            if (runtime.envType === runtime.EnvType.PRODUCTION) {
                cmsPrefix = 'neo-uk.';
            }
            else {
                cmsPrefix = 'qa.';
            }

            if (neoReorder == 0) {

                var orderHeaderId = GetNeoOrderHeaderId(soDescription);
                var note = 'Credit against Item ' + itemSku + ' (' + itemName + '): Order ' + orderHeaderId + ' Credit created on NetSuite for £' + amountToCredit;

                return exchangeOnNeo(orderHeaderId, soLp, note, quantityToCredit, itemPrice, apiKey, cmsPrefix, crypto);
            } else {
                return reorderOnNeo(soLp, quantityToCredit, apiKey, cmsPrefix, crypto);
            }
        }

        function exchangeOnNeo(orderHeaderId, orderDetailId, note, quantityToCredit, salePrice, key, cmsPrefix, crypto) {
            var response;
            var url;
            var payload;
            var headers;
            var apiKey;

            var today = new Date();

                var inputDate = today.getFullYear() + '' +
                    ('0' + (today.getMonth()+1)).slice(-2) + '' +
                    ('0' + today.getDate()).slice(-2);

                var hashObj = crypto.createHash({
                    algorithm: crypto.HashAlg.SHA256
                   });

                hashObj.update({
                    input: inputDate
                });

                var hashedValue = hashObj.digest().toLowerCase();
                apiKey = key + hashedValue;

            try {
                // Headers
                headers = {
                    'Content-Type': 'application/json',
                    'accept': 'application/json',
                    'apiKey': apiKey
                };

                // Endpoint
                url = 'https://' + cmsPrefix + 'giftlistmanager.com/netsuite/salesorder/CreditSalesOrderItem';

                // Payload
                payload = {
                    "SalesOrderId": parseInt(orderHeaderId),
                    "OrderDetailId": parseInt(orderDetailId),
                    "Notes": note,
                    "QuantityToCredit": parseInt(quantityToCredit),
                    "SalePrice": parseFloat(salePrice)
                };

                response = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(payload)
                });

                if (response.code == '204') {
                    log.audit('LP exchanged, credit applied');
                    return 1;
                } else {
                    log.error({title:'Exchange failed', details:response.body});
                    return -1;
                }
            } catch (err) {
                log.error('Exchange failed', err);
                return -1;
            }
        }

        function reorderOnNeo(orderDetailId, quantityToCredit, key, cmsPrefix, crypto) {
            var response;
            var url;
            var payload;
            var headers;
            var apiKey;

            var today = new Date();

                var inputDate = today.getFullYear() + '' +
                    ('0' + (today.getMonth()+1)).slice(-2) + '' +
                    ('0' + today.getDate()).slice(-2);

                var hashObj = crypto.createHash({
                    algorithm: crypto.HashAlg.SHA256
                   });

                hashObj.update({
                    input: inputDate
                });

                var hashedValue = hashObj.digest().toLowerCase();
                apiKey = key + hashedValue;

            try {
                // Headers
                headers = {
                    'Content-Type': 'application/json',
                    'accept': 'application/json',
                    'apiKey': apiKey
                };

                // Endpoint
                url = 'https://' + cmsPrefix + 'giftlistmanager.com/netsuite/salesorder/CreditAndReorderSalesOrderItem';

                // Payload
                payload = {
                    "OrderDetailId": parseInt(orderDetailId),
                    "QuantityToCredit": parseInt(quantityToCredit),
                };

                response = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(payload)
                });

                if (response.code == '204') {
                    log.audit('LP exchanged, new Lp created');
                    return 1;
                } else {
                    log.error({title:'Exchange failed', details:response.body});
                    return -1;
                }
            } catch (err) {
                log.error('Exchange failed', err);
                return -1;
            }
        }

        function createCreditMemo(customer, amount, quantity, item, exchangedItemName, user) {

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
                value: 'Created by automatic exchange by ' + user
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
                fieldId: 'custcol_gross_amount_entry',
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

        function isExchangeForPrezola(customer){
            var owning_brand_id = customer.getValue({
                fieldId: 'custentity_owning_brand'
            });

            return owning_brand_id == 9;
        }

        function getCustomerFromSalesOrder(salesOrder_id){

            var salesOrder = record.load({
                type: record.Type.SALES_ORDER,
                id: salesOrder_id
            });

            if (!salesOrder) {
                log.error('Sales Order not loaded', [salesOrder_id]);
                html = 'Failed, nothing processed';
                context.response.write(html);
                return
            }

            var customerId = salesOrder.getValue({
                fieldId: 'entity'
            });

            var customer = record.load({
                type: record.Type.CUSTOMER,
                id: customerId
            });

            if (!customer) {
                log.error('Customer not found', [customerId]);
                html = 'Failed. Nothing processed.';
                context.response.write(html);
                return
            }

            return customer;
        }

        return {
            onRequest: onRequest
        }
    });
