# Registers the DeviceActivityReport extension (RoutinerReport) with the Xcode
# project: `cd ios && ruby add-report-target.rb`. Idempotent.
require 'xcodeproj'

proj = Xcodeproj::Project.open('habittracker.xcodeproj')
app = proj.targets.find { |t| t.name == 'habittracker' }
abort('app target not found') unless app
abort('report target already exists') if proj.targets.any? { |t| t.name == 'RoutinerReport' }

report = proj.new_target(:app_extension, 'RoutinerReport', :ios, '16.0')

group = proj.main_group.new_group('RoutinerReport', 'RoutinerReport')
swift_ref = group.new_file('RoutinerReport.swift')
group.new_file('Info.plist')
group.new_file('RoutinerReport.entitlements')
report.add_file_references([swift_ref])

report.build_configurations.each do |config|
  bs = config.build_settings
  bs['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.lucidbots.lucidbots.RoutinerReport'
  bs['PRODUCT_NAME'] = 'RoutinerReport'
  bs['INFOPLIST_FILE'] = 'RoutinerReport/Info.plist'
  bs['GENERATE_INFOPLIST_FILE'] = 'NO'
  bs['CODE_SIGN_ENTITLEMENTS'] = 'RoutinerReport/RoutinerReport.entitlements'
  bs['DEVELOPMENT_TEAM'] = 'QAW658347B'
  bs['SWIFT_VERSION'] = '5.0'
  bs['TARGETED_DEVICE_FAMILY'] = '1,2'
  bs['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
  bs['SKIP_INSTALL'] = 'YES'
  bs['CURRENT_PROJECT_VERSION'] = '1'
  bs['MARKETING_VERSION'] = '1.0'
  bs['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
end

app.add_dependency(report)

embed = app.copy_files_build_phases.find { |p| p.name == 'Embed Foundation Extensions' }
embed ||= app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins
bf = embed.add_file_reference(report.product_reference)
bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

# The host module lives in the app target and must compile there.
host = proj.main_group.find_subpath('habittracker', false)
unless app.source_build_phase.files_references.any? { |r| r.path.to_s.end_with?('ScreenTimeReport.swift') }
  # The habittracker group is a plain <group> with no path, so a file added to
  # it resolves against ios/ — give the refs SOURCE_ROOT paths like AppLock.swift.
  refs = %w[ScreenTimeReport.swift ScreenTimeReport.m].map do |name|
    ref = host.new_file(name)
    ref.source_tree = 'SOURCE_ROOT'
    ref.path = "habittracker/#{name}"
    ref
  end
  app.add_file_references(refs)
end

proj.save
puts 'report target added'
