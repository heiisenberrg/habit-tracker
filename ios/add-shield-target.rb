require 'xcodeproj'

proj = Xcodeproj::Project.open('habittracker.xcodeproj')
app = proj.targets.find { |t| t.name == 'habittracker' }
abort('app target not found') unless app
abort('shield target already exists') if proj.targets.any? { |t| t.name == 'RoutinerShield' }

# --- ShieldConfiguration (Managed Settings UI) extension target ---
shield = proj.new_target(:app_extension, 'RoutinerShield', :ios, '16.0')

group = proj.main_group.new_group('RoutinerShield', 'RoutinerShield')
swift_ref = group.new_file('RoutinerShield.swift')
group.new_file('Info.plist')
group.new_file('RoutinerShield.entitlements')
shield.add_file_references([swift_ref])

shield.build_configurations.each do |config|
  bs = config.build_settings
  bs['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.lucidbots.lucidbots.RoutinerShield'
  bs['PRODUCT_NAME'] = 'RoutinerShield'
  bs['INFOPLIST_FILE'] = 'RoutinerShield/Info.plist'
  bs['GENERATE_INFOPLIST_FILE'] = 'NO'
  bs['CODE_SIGN_ENTITLEMENTS'] = 'RoutinerShield/RoutinerShield.entitlements'
  bs['DEVELOPMENT_TEAM'] = 'QAW658347B'
  bs['SWIFT_VERSION'] = '5.0'
  bs['TARGETED_DEVICE_FAMILY'] = '1,2'
  bs['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
  bs['SKIP_INSTALL'] = 'YES'
  bs['CURRENT_PROJECT_VERSION'] = '1'
  bs['MARKETING_VERSION'] = '1.0'
  bs['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
end

app.add_dependency(shield)

embed = app.copy_files_build_phases.find { |p| p.name == 'Embed Foundation Extensions' }
embed ||= app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins
bf = embed.add_file_reference(shield.product_reference)
bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

proj.save
puts 'shield target added'
