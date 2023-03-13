/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/task', 'N/runtime'],
    /**
 * @param{task} task
 */
    (task, runtime) => {

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {

            var scriptObj = runtime.getCurrentScript();
            var searchId = scriptObj.getParameter({ name: "custscript_saved_search_int_id" });
            var destinationPath = scriptObj.getParameter({ name: "custscript_destination_path" });

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
