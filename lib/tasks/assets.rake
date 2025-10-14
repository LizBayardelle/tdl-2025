# Override css:build to skip on Heroku (prebuilt assets are committed)
if ENV['SKIP_CSS_BUILD'] == 'true'
  Rake::Task['css:build'].clear
  namespace :css do
    task :build do
      puts "Skipping CSS build (using prebuilt assets)"
    end
  end
end
