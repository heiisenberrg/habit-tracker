# Adds AppLock.swift + AppLockBridge.m to the habittracker app target.
# Run from ios/: ruby add-applock-files.rb
require 'xcodeproj'

project = Xcodeproj::Project.open('habittracker.xcodeproj')
target = project.targets.find { |t| t.name == 'habittracker' }
raise 'app target not found' unless target

group = project.main_group['habittracker']
raise 'habittracker group not found' unless group

%w[AppLock.swift AppLockBridge.m].each do |name|
  existing = project.files.find { |f| f.path&.end_with?(name) }
  if existing
    puts "already in project: #{name}"
    next
  end
  ref = group.new_file(name)
  target.source_build_phase.add_file_reference(ref, true)
  puts "added: #{name}"
end

project.save
puts 'saved'
