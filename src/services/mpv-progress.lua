-- OpenAnime CLI Progress Tracker
local utils = require 'mp.utils'
local msg = require 'mp.msg'

-- Get progress file and history info from script options
local options = require 'mp.options'
local opts = {
    progress_file = "",
    history_file = "",
    anime_slug = "",
    season_number = 0,
    episode_number = 0,
    anime_id = "",
    anime_title = "",
    episode_title = "",
    fansub_name = ""
}
options.read_options(opts)

local progress_file = opts.progress_file
local history_file = opts.history_file

if not progress_file or progress_file == "" then
    -- Fallback to hardcoded path
    progress_file = "/home/luxotick/Documents/Github/openanime-cli/temp_progress.json"
end

msg.info("OpenAnime progress tracker loaded")
msg.info("Progress file: " .. progress_file)
if history_file and history_file ~= "" then
    msg.info("History file: " .. history_file)
end

-- Update history file with current progress
function update_history(time_pos, duration, percent_pos)
    if not history_file or history_file == "" then
        return -- No history file specified
    end
    
    if not opts.anime_id or opts.anime_id == "" then
        return -- No anime info provided
    end
    
    local file = io.open(history_file, "r")
    local history = {}
    
    -- Read existing history
    if file then
        local content = file:read("*all")
        file:close()
        if content and content ~= "" then
            local success, parsed = pcall(utils.parse_json, content)
            if success and parsed then
                history = parsed
            end
        end
    end
    
    -- Find and update the current episode entry
    local updated = false
    for i, entry in ipairs(history) do
        if entry.animeId == opts.anime_id and 
           entry.seasonNumber == opts.season_number and 
           entry.episodeNumber == opts.episode_number then
            
            -- Update progress
            entry.progress = math.floor(percent_pos or 0)
            entry.timePos = math.floor(time_pos or 0)
            entry.duration = math.floor(duration or 0)
            entry.watchedAt = os.date("!%Y-%m-%dT%H:%M:%S.000Z")
            
            updated = true
            msg.info("Updated history: " .. entry.progress .. "% (" .. entry.timePos .. "s/" .. entry.duration .. "s)")
            break
        end
    end
    
    -- If not found, create new entry
    if not updated then
        local new_entry = {
            animeId = opts.anime_id,
            animeTitle = opts.anime_title,
            animeSlug = opts.anime_slug,
            seasonNumber = opts.season_number,
            episodeNumber = opts.episode_number,
            episodeTitle = opts.episode_title,
            fansubName = opts.fansub_name,
            watchedAt = os.date("!%Y-%m-%dT%H:%M:%S.000Z"),
            progress = math.floor(percent_pos or 0),
            timePos = math.floor(time_pos or 0),
            duration = math.floor(duration or 0)
        }
        
        table.insert(history, 1, new_entry)
        msg.info("Created new history entry: " .. new_entry.progress .. "%")
    end
    
    -- Write updated history back
    file = io.open(history_file, "w")
    if file then
        local json_str = utils.format_json(history)
        file:write(json_str)
        file:close()
    else
        msg.error("Cannot write to history file: " .. history_file)
    end
end
function write_progress(status)
    local time_pos = mp.get_property_number("time-pos", 0)
    local duration = mp.get_property_number("duration", 0)
    local percent_pos = mp.get_property_number("percent-pos", 0)
    
    -- Try alternative properties for duration and position
    if duration == 0 then
        duration = mp.get_property_number("length", 0)
    end
    
    -- Fallback: calculate percent_pos from time_pos and duration if available
    if percent_pos == 0 and duration > 0 and time_pos > 0 then
        percent_pos = (time_pos / duration) * 100
    end
    
    -- If we still don't have duration but have time_pos, estimate based on typical anime episode length
    if duration == 0 and time_pos > 0 then
        -- Assume 24 minutes for typical anime episode if duration unknown
        local estimated_duration = 24 * 60
        percent_pos = math.min((time_pos / estimated_duration) * 100, 99)
        msg.info("Using estimated duration: " .. estimated_duration .. "s")
    end
    
    local progress_data = {
        timestamp = os.time(),
        time_pos = math.floor(time_pos or 0),
        duration = math.floor(duration or 0),
        percent_pos = math.floor(percent_pos or 0),
        status = status or "playing",
        estimated = duration == 0 and time_pos > 0
    }
    
    local json_str = utils.format_json(progress_data)
    local file = io.open(progress_file, "w")
    if file then
        file:write(json_str)
        file:close()
        local duration_text = progress_data.estimated and (progress_data.duration .. "s (estimated)") or (progress_data.duration .. "s")
        msg.info("Progress written: " .. progress_data.percent_pos .. "% (" .. progress_data.time_pos .. "s/" .. duration_text .. ") - " .. status)
    else
        msg.error("Cannot write to: " .. progress_file)
    end
    
    -- Also update history file if available
    update_history(time_pos, duration, percent_pos)
end

-- Write progress every 5 seconds (daha sık kontrol)
mp.add_periodic_timer(5, function()
    write_progress("playing")
end)

-- Write on exit (preserve last known progress, just update status)
mp.register_event("shutdown", function()
    -- Only update status to finished, don't reset time_pos
    local current_time = mp.get_property_number("time-pos", 0)
    local current_duration = mp.get_property_number("duration", 0)
    local current_percent = mp.get_property_number("percent-pos", 0)
    
    -- If current values are 0, try to read from existing file
    if current_time == 0 or current_duration == 0 then
        local existing_file = io.open(progress_file, "r")
        if existing_file then
            local existing_content = existing_file:read("*all")
            existing_file:close()
            
            local existing_data = utils.parse_json(existing_content)
            if existing_data then
                current_time = math.max(current_time, existing_data.time_pos or 0)
                current_duration = math.max(current_duration, existing_data.duration or 0)
                if current_percent == 0 then
                    current_percent = existing_data.percent_pos or 0
                end
            end
        end
    end
    
    -- Calculate percentage if we have time and duration
    if current_percent == 0 and current_duration > 0 and current_time > 0 then
        current_percent = (current_time / current_duration) * 100
    end
    
    local progress_data = {
        timestamp = os.time(),
        time_pos = math.floor(current_time),
        duration = math.floor(current_duration),
        percent_pos = math.floor(current_percent),
        status = "finished",
        estimated = false
    }
    
    local json_str = utils.format_json(progress_data)
    local file = io.open(progress_file, "w")
    if file then
        file:write(json_str)
        file:close()
        msg.info("Finished - preserved progress: " .. progress_data.percent_pos .. "% (" .. progress_data.time_pos .. "s/" .. progress_data.duration .. "s)")
    end
end)

-- Wait for file to load and metadata to be available
mp.register_event("file-loaded", function()
    msg.info("File loaded, waiting for metadata...")
    mp.add_timeout(5, function() -- Wait 5 seconds for metadata
        write_progress("started")
    end)
end)

-- Additional event handlers for better metadata detection
mp.register_event("metadata-update", function()
    msg.info("Metadata updated")
    write_progress("metadata_ready")
end)

mp.register_event("playback-restart", function()
    msg.info("Playback restarted")
    write_progress("restarted")
end)

-- Listen for property changes
mp.observe_property("duration", "number", function(name, val)
    if val and val > 0 then
        msg.info("Duration detected: " .. val .. " seconds")
        write_progress("duration_detected")
    end
end)
