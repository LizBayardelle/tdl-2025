class ApplicationMailer < ActionMailer::Base
  default from: ENV.fetch("SENDGRID_FROM_EMAIL", "support@mapmyresearch.com")
  layout "mailer"
end
