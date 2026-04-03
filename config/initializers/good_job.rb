# frozen_string_literal: true

Rails.application.configure do
  config.good_job.preserve_job_records = true
  config.good_job.retry_on_unhandled_error = false
  config.good_job.on_thread_error = ->(exception) { Rails.logger.error(exception) }

  # Heroku-friendly settings
  config.good_job.execution_mode = :async # Jobs processed in web process background threads
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
