# frozen_string_literal: true

Rails.application.configure do
  config.good_job.preserve_job_records = true
  config.good_job.retry_on_unhandled_error = false
  config.good_job.on_thread_error = ->(exception) { Rails.logger.error(exception) }

  # Execution mode:
  #   dev / test  → :async (one process handles both web and jobs)
  #   production  → :external (web dyno only enqueues; worker dyno runs jobs
  #                 via `bundle exec good_job start` from the Procfile)
  #
  # On Heroku you must `heroku ps:scale worker=1` to enable the worker dyno.
  # Without a running worker, jobs sit in the queue indefinitely.
  config.good_job.execution_mode =
    if ENV['GOOD_JOB_EXECUTION_MODE'].present?
      ENV['GOOD_JOB_EXECUTION_MODE'].to_sym
    elsif Rails.env.production?
      :external
    else
      :async
    end

  config.good_job.shutdown_timeout = 25 # seconds before Heroku's 30s kill
  config.good_job.max_threads = 2 # Keep memory usage low on Standard-1X dyno

  # Use LISTEN/NOTIFY for realtime job notifications (no polling)
  config.good_job.poll_interval = 30 # Fallback polling interval in seconds

  # Queue configuration
  config.good_job.queues = '*'

  # Cron jobs for scheduled tasks
  config.good_job.enable_cron = true
  config.good_job.cron = {
    cleanup_stale_uploads: {
      cron: '0 3 * * *', # Daily at 3am
      class: 'CleanupStaleUploadsJob',
      description: 'Remove abandoned batch uploads older than 7 days'
    }
  }
end
