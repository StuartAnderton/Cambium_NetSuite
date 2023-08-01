/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/email', 'N/file', 'N/query', 'N/record', 'N/runtime', 'N/search', 'N/error'],
    /**

     */
    (email, file, query, record, runtime, search, error) => {
        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @param {Object} inputContext
         * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Object} inputContext.ObjectRef - Object that references the input data
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */

        const getInputData = (inputContext) => {


            // CSV Definition

            var CSVDEF = [
                {
                    fieldName: 'itemMPN',
                    columnName: 'Item',
                    column: 2
                },
                {
                    fieldName: 'inStockDate',
                    columnName: 'Back in stock',
                    column: 7
                },
                {
                    fieldName: 'poName',
                    columnName: 'PO',
                    column: 1
                },
                {
                    fieldName: 'quantityOrdered',
                    columnName: 'Units ordered',
                    column: 4
                },
                {
                    fieldName: 'quantitySent',
                    columnName: 'Units sent',
                    column: 5
                }
            ]

            // Read CSV from File Cabinet

            var csvFile = file.load({
                id: 2321957
            });

            // Parse CSV into array

            var lineHeaders = []
            var iterator = csvFile.lines.iterator();

            // Read the CSV header line and check columns

            iterator.each(function (line) {
                lineHeaders = line.value.split(',');
                return false;
            });

            CSVDEF.forEach(function (field, index) {

                log.debug('CSV Def line ' + index, [field, lineHeaders.indexOf(field.columnName)])

                if (lineHeaders.indexOf(field.columnName) === -1) {
                    log.error('CSV column not found', field.columnName)
                    throw error.create({
                        name: 'CSV FORMAT ERROR',
                        message: 'CSV column not found ' + field.columnName,
                        notifyOff: false
                    }).message;
                }

                if (field.column !== lineHeaders.indexOf(field.columnName)) {
                    CSVDEF[index].column = lineHeaders.indexOf(field.columnName)
                }

            })

            log.debug('Headers', lineHeaders)
            log.debug('CSVDEF', CSVDEF)

            // Process each remaining line in the file

            var output = []
            iterator.each(function (line) {

                var lineColumns = line.value.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

                if (lineColumns[1] != '') {

                    log.debug('Line value', lineColumns)
                    var lineOutput = []

                    lineColumns.forEach(function (columnValue, index) {

                        log.debug('Column ' + index, [columnValue])
                        log.debug('CSV def index', CSVDEF.map(x => x.column).indexOf(index))

                        if (CSVDEF.map(x => x.column).indexOf(index) !== -1) {
                            var key = CSVDEF[CSVDEF.map(x => x.column).indexOf(index)].fieldName
                            lineOutput = {...lineOutput, [key]: columnValue}
                        }
                    })


                    output.push(lineOutput)
                }
                return true;
            });

            log.debug('Output', output)


            // Send a line at a time to Map stage

        }

        /**
         * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
         * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
         * context.
         * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
         *     is provided automatically based on the results of the getInputData stage.
         * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
         *     function on the current key-value pair
         * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
         *     pair
         * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} mapContext.key - Key to be processed during the map stage
         * @param {string} mapContext.value - Value to be processed during the map stage
         * @since 2015.2
         */

        const map = (mapContext) => {

            // Look up MPN or SKU > Item Record

            // Edit Item Record if required

            // Search for Transactions needing updating

            // Pass line details to Reduce with key = PO, value = object containing line ID and new values

        }

        /**
         * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
         * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
         * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
         *     provided automatically based on the results of the map stage.
         * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
         *     reduce function on the current group
         * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
         * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} reduceContext.key - Key to be processed during the reduce stage
         * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
         *     for processing
         * @since 2015.2
         */
        const reduce = (reduceContext) => {

            // update Transaction based on input

        }


        /**
         * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
         * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
         * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
         * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
         *     script
         * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
         * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
         * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
         * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
         *     script
         * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
         * @param {Object} summaryContext.inputSummary - Statistics about the input stage
         * @param {Object} summaryContext.mapSummary - Statistics about the map stage
         * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
         * @since 2015.2
         */
        const summarize = (summaryContext) => {

            // email result to Purchaser

        }

        return {getInputData, map, reduce, summarize}

    });
