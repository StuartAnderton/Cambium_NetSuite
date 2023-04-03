/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/task', 'N/runtime', 'N/file'],
    /**
     * @param{task} task
     */
    (task, runtime, file) => {

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {

            var scriptObj = runtime.getCurrentScript();
            var searchId = scriptObj.getParameter({name: 'custscript_saved_search_int_id'});
            var destinationPath = scriptObj.getParameter({name: 'custscript_destination_path'});

            try {
                var lastCSV = file.load({
                    id: 'Uploaded to Shopify/Orders.csv'
                })

                var fileId = lastCSV.id

                file.delete({
                    id: fileId
                })
            } catch (err) {
                log.audit('Error deleting previous CSV', err)
            }


            var searchTask = task.create({
                taskType: task.TaskType.SEARCH
            });

            searchTask.savedSearchId = searchId;

            searchTask.filePath = destinationPath;

            var searchTaskId = searchTask.submit();

            log.audit('Search save submitted', searchTaskId)



        }

        return {execute}

    });
