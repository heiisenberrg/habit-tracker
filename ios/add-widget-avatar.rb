require 'xcodeproj'
proj = Xcodeproj::Project.open('habittracker.xcodeproj')
widget = proj.targets.find { |t| t.name == 'RoutinerWidget' }
abort('no widget target') unless widget
group = proj.main_group['RoutinerWidget']
ref = group.new_file('avatar.png')
widget.resources_build_phase.add_file_reference(ref)
proj.save
puts 'avatar wired'
