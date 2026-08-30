require 'xcodeproj'

proj = Xcodeproj::Project.open('habittracker.xcodeproj')
app = proj.targets.find { |t| t.name == 'habittracker' }
abort('app target not found') unless app
abort('widget target already exists') if proj.targets.any? { |t| t.name == 'RoutinerWidget' }

# --- Widget extension target ---
widget = proj.new_target(:app_extension, 'RoutinerWidget', :ios, '17.0')

group = proj.main_group.new_group('RoutinerWidget', 'RoutinerWidget')
swift_ref = group.new_file('RoutinerWidget.swift')
group.new_file('Info.plist')
group.new_file('RoutinerWidget.entitlements')
widget.add_file_references([swift_ref])

widget.build_configurations.each do |config|
  bs = config.build_settings
  bs['PRODUCT_BUNDLE_IDENTIFIER'] = 'org.reactjs.native.example.habittracker.RoutinerWidget'
  bs['PRODUCT_NAME'] = 'RoutinerWidget'
  bs['INFOPLIST_FILE'] = 'RoutinerWidget/Info.plist'
  bs['GENERATE_INFOPLIST_FILE'] = 'NO'
  bs['CODE_SIGN_ENTITLEMENTS'] = 'RoutinerWidget/RoutinerWidget.entitlements'
  bs['SWIFT_VERSION'] = '5.0'
  bs['TARGETED_DEVICE_FAMILY'] = '1,2'
  bs['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
  bs['SKIP_INSTALL'] = 'YES'
  bs['CURRENT_PROJECT_VERSION'] = '1'
  bs['MARKETING_VERSION'] = '1.0'
  bs['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
end

app.add_dependency(widget)

embed = app.copy_files_build_phases.find { |p| p.name == 'Embed Foundation Extensions' }
embed ||= app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins
bf = embed.add_file_reference(widget.product_reference)
bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

# --- WidgetBridge.m into the app target ---
appdelegate_ref = proj.files.find { |f| f.path == 'habittracker/AppDelegate.swift' }
app_group = appdelegate_ref.parent
bridge_ref = app_group.new_file('habittracker/WidgetBridge.m')
app.source_build_phase.add_file_reference(bridge_ref)

proj.save
puts 'widget target added'
